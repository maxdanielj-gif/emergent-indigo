from fastapi import FastAPI, Request, Response
import httpx

app = FastAPI()

NODE_BASE = "http://localhost:3000"


@app.api_route(
    "/api/{path:path}",
    methods=["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"],
)
async def proxy_api(request: Request, path: str):
    target_url = f"{NODE_BASE}/api/{path}"
    if request.query_params:
        target_url += f"?{request.query_params}"

    body = await request.body()
    headers = {
        k: v
        for k, v in request.headers.items()
        if k.lower() not in ("host", "content-length", "transfer-encoding", "connection")
    }

    async with httpx.AsyncClient(timeout=httpx.Timeout(180.0)) as client:
        response = await client.request(
            method=request.method,
            url=target_url,
            headers=headers,
            content=body,
        )

    exclude = {"transfer-encoding", "connection", "content-encoding"}
    resp_headers = {
        k: v for k, v in response.headers.items() if k.lower() not in exclude
    }

    return Response(
        content=response.content,
        status_code=response.status_code,
        headers=resp_headers,
        media_type=response.headers.get("content-type"),
    )


@app.get("/health")
async def health():
    return {"status": "ok"}
