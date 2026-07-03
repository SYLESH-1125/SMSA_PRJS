import os
from fastapi import FastAPI, Request, Form
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

from model.generate import generate_text

app = FastAPI(title="LLM Fable-5 (scaffold)")

templates = Jinja2Templates(directory=str(os.path.join(os.path.dirname(__file__), "templates")))
app.mount("/static", StaticFiles(directory=str(os.path.join(os.path.dirname(__file__), "static"))), name="static")


@app.get("/", response_class=HTMLResponse)
async def index(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})


@app.post("/generate")
async def generate(prompt: str = Form(...), max_length: int = Form(128)):
    try:
        out = generate_text(prompt, max_length=int(max_length), num_return_sequences=1)
        return JSONResponse({"outputs": out})
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)
