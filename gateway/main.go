package main

import (
  "log"
  "net/http"
  "net/http/httputil"
  "net/url"
  "os"
  "strings"
  "sync/atomic"
  "time"
)

func main() {
  raw := os.Getenv("OMNIRA_UPSTREAMS")
  if raw == "" { raw = "http://127.0.0.1:8000" }
  var targets []*url.URL
  for _, item := range strings.Split(raw, ",") {
    target, err := url.Parse(strings.TrimSpace(item))
    if err != nil || target.Scheme == "" || target.Host == "" { log.Fatalf("invalid upstream: %q", item) }
    targets = append(targets, target)
  }
  var next uint64
  proxy := &httputil.ReverseProxy{
    Director: func(req *http.Request) {
      target := targets[(atomic.AddUint64(&next, 1)-1)%uint64(len(targets))]
      req.URL.Scheme = target.Scheme
      req.URL.Host = target.Host
      req.Host = target.Host
      req.Header.Set("X-Forwarded-Proto", "http")
    },
    Transport: &http.Transport{Proxy:http.ProxyFromEnvironment, MaxIdleConns:100, IdleConnTimeout:90*time.Second},
    ErrorHandler: func(w http.ResponseWriter, req *http.Request, err error) { log.Printf("upstream error: %v",err); http.Error(w,"API temporarily unavailable",http.StatusBadGateway) },
  }
  addr := os.Getenv("OMNIRA_GATEWAY_ADDR")
  if addr == "" { addr = ":8080" }
  log.Printf("Omnira gateway listening on %s with %d upstream(s)",addr,len(targets))
  log.Fatal(http.ListenAndServe(addr, proxy))
}
