package main

import (
    "context"
    "io"
    "net/http"
    "net/http/httptest"
    "strings"
    "sync/atomic"
    "testing"
)

func upstream(name string) *httptest.Server {
    return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        if r.URL.Path == "/ready" { w.WriteHeader(200); return }
        _, _ = io.WriteString(w, name)
    }))
}

func TestRoundRobinAndHealthFiltering(t *testing.T) {
    a, b := upstream("a"), upstream("b")
    defer a.Close(); defer b.Close()
    p, err := newPool(a.URL+","+b.URL)
    if err != nil { t.Fatal(err) }
    p.check(context.Background())
    for i, want := range []string{"a","b","a","b"} {
        w := httptest.NewRecorder()
        p.ServeHTTP(w, httptest.NewRequest("GET", "/dashboard", nil))
        if w.Body.String() != want { t.Fatalf("request %d: got %q want %q", i, w.Body.String(), want) }
    }
    p.backends[0].healthy.Store(false)
    for i:=0; i<3; i++ {
        w:=httptest.NewRecorder(); p.ServeHTTP(w,httptest.NewRequest("GET","/",nil))
        if w.Body.String()!="b" { t.Fatal("unhealthy upstream was selected") }
    }
    p.backends[1].healthy.Store(false)
    w:=httptest.NewRecorder();p.ServeHTTP(w,httptest.NewRequest("GET","/",nil))
    if w.Code!=503 {t.Fatalf("got %d",w.Code)}
}

func TestHealthProbeAndRecovery(t *testing.T) {
    var ready atomic.Bool
    a:=httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter,r *http.Request){if !ready.Load(){w.WriteHeader(503)}}))
    defer a.Close()
    p,_:=newPool(a.URL)
    p.check(context.Background())
    if p.choose()!=nil {t.Fatal("failed readiness probe was ignored")}
    ready.Store(true);p.check(context.Background())
    if p.choose()==nil {t.Fatal("recovered upstream was not restored")}
}

func TestPostIsNotReplayed(t *testing.T) {
    var writes atomic.Int32
    a:=httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter,r *http.Request){writes.Add(1);w.WriteHeader(503)}))
    b:=httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter,r *http.Request){writes.Add(1)}))
    defer a.Close();defer b.Close()
    p,_:=newPool(a.URL+","+b.URL)
    w:=httptest.NewRecorder();p.ServeHTTP(w,httptest.NewRequest("POST","/sync/push",strings.NewReader(`{}`)))
    if writes.Load()!=1 {t.Fatal("POST was replayed")}
}

func TestInvalidUpstreams(t *testing.T){
    for _, raw:=range []string{"", "ftp://example.com", "http://user:password@example.com", "http://example.com/path"}{
        if _,err:=newPool(raw);err==nil {t.Fatalf("accepted %q",raw)}
    }
}
