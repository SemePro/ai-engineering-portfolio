FROM python:3.11-slim

WORKDIR /app
RUN useradd --create-home --uid 10001 app
COPY pyproject.toml README.md ./
COPY src ./src
RUN pip install --no-cache-dir .

USER app
ENV DATA_DIR=/app/var
EXPOSE 8006
HEALTHCHECK --interval=30s --timeout=5s CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8006/health')"
CMD ["uvicorn", "incident_agent.main:app", "--host", "0.0.0.0", "--port", "8006"]
