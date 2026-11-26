package main

import (
    "context"
    "errors"
    "fmt"
    "io"
    "log"
    "net/http"
    "net"
    "net/http/httputil"
    "net/url"
    "os"
    "os/signal"
    "strconv"
    "strings"
    "sync/atomic"
    "syscall"
    "time"
)

type backend struct {
    target *url.URL
    healthy atomic.Bool
    proxy *httputil.ReverseProxy
}

type pool struct {
    backends []*backend
    next atomic.Uint64
    client *http.Client
}

func newPool(raw string) (*pool, error) {
    p := &pool{client: &http.Client{Timeout: 3 * time.Second}}
    for _, item := range strings.Split(raw, ",") {
        target, err := url.Parse(strings.TrimSpace(item))
        if err != nil || (target.Scheme != "http" && target.Scheme != "https") || target.Host == "" || target.User != nil || target.Path != "" || target.RawQuery != "" {
            return nil, fmt.Errorf("invalid upstream %q: use an http(s) origin without a path", item)
        }
        b := &backend{target: target}
        b.healthy.Store(true)
        b.proxy = &httputil.ReverseProxy{
            Rewrite: func(r *httputil.ProxyRequest) {
                r.SetURL(b.target)
                r.SetXForwarded()
            },
            Transport: &http.Transport{
                Proxy: http.ProxyFromEnvironment,
                DialContext: (&net.Dialer{Timeout: 5*time.Second, KeepAlive: 30*time.Second}).DialContext,
                TLSHandshakeTimeout: 10*time.Second,
                MaxConnsPerHost: 100,
                MaxIdleConns: 200, MaxIdleConnsPerHost: 50,
                IdleConnTimeout: 90 * time.Second,
                ResponseHeaderTimeout: 65 * time.Second,
            },
            ErrorHandler: func(w http.ResponseWriter, r *http.Request, err error) {
                b.healthy.Store(false)
                w.Header().Set("Content-Type", "application/json")
                log.Printf("upstream %s unavailable: %v", b.target.Host, err)
                // Never replay a POST: its outcome may already be committed.
                // Device sync and upload requests use persisted idempotent IDs.
                http.Error(w, `{"detail":"API temporarily unavailable; retry safely"}`, http.StatusBadGateway)
            },
        }
        p.backends = append(p.backends, b)
    }
    if len(p.backends) == 0 { return nil, errors.New("at least one upstream is required") }
    return p, nil
}

func (p *pool) choose() *backend {
    start := int((p.next.Add(1) - 1) % uint64(len(p.backends)))
    for offset := 0; offset < len(p.backends); offset++ {
        b := p.backends[(start+offset)%len(p.backends)]
        if b.healthy.Load() { return b }
    }
    return nil
}

func (p *pool) check(ctx context.Context) {
    for _, b := range p.backends {
        req, err := http.NewRequestWithContext(ctx, http.MethodGet, b.target.String()+"/ready", nil)
        if err != nil { b.healthy.Store(false); continue }
        response, err := p.client.Do(req)
        healthy := err == nil && response.StatusCode == http.StatusOK
        if response != nil {
            _, _ = io.Copy(io.Discard, io.LimitReader(response.Body, 4096))
            _ = response.Body.Close()
        }
        b.healthy.Store(healthy)
    }
}

func (p *pool) ServeHTTP(w http.ResponseWriter, r *http.Request) {
    if r.URL.Path == "/healthz" {
        w.Header().Set("Content-Type", "application/json")
        healthy := 0
        for _, b := range p.backends { if b.healthy.Load() { healthy++ } }
        if healthy == 0 { w.WriteHeader(http.StatusServiceUnavailable) }
        _, _ = fmt.Fprintf(w, `{"healthy_upstreams":%d,"total_upstreams":%d}`, healthy, len(p.backends))
        return
    }
    b := p.choose()
    if b == nil {
        w.Header().Set("Content-Type", "application/json")
        w.Header().Set("Retry-After", "5")
        http.Error(w, `{"detail":"No healthy API instances"}`, http.StatusServiceUnavailable)
        return
    }
    b.proxy.ServeHTTP(w, r)
}

func main() {
    raw := os.Getenv("OMNIRA_UPSTREAMS")
    if raw == "" { raw = "http://127.0.0.1:8000" }
    p, err := newPool(raw)
    if err != nil { log.Fatal(err) }
    ctx, cancel := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
    defer cancel()
    p.check(ctx)
    go func() {
        ticker := time.NewTicker(5 * time.Second)
        defer ticker.Stop()
        for {
            select {
            case <-ticker.C: p.check(ctx)
            case <-ctx.Done(): return
            }
        }
    }()
    addr := os.Getenv("OMNIRA_GATEWAY_ADDR")
    if addr == "" { addr = ":8080" }
    maxBody := int64(12 * 1024 * 1024)
    if value := os.Getenv("OMNIRA_MAX_REQUEST_BYTES"); value != "" {
        maxBody, err = strconv.ParseInt(value, 10, 64)
        if err != nil || maxBody <= 0 { log.Fatal("invalid OMNIRA_MAX_REQUEST_BYTES") }
    }
    server := &http.Server{
        Addr: addr, Handler: http.MaxBytesHandler(p, maxBody),
        ReadHeaderTimeout: 5 * time.Second, ReadTimeout: 90 * time.Second,
        WriteTimeout: 90 * time.Second, IdleTimeout: 60 * time.Second,
    }
    go func() {
        <-ctx.Done()
        shutdown, stop := context.WithTimeout(context.Background(), 10*time.Second)
        defer stop()
        _ = server.Shutdown(shutdown)
    }()
    log.Printf("Omnira gateway listening on %s with %d upstreams", addr, len(p.backends))
    if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) { log.Fatal(err) }
}
