FROM python:3.12-slim
WORKDIR /opt/omnira
COPY backend/requirements.txt /opt/omnira/backend/requirements.txt
RUN pip install --no-cache-dir -r /opt/omnira/backend/requirements.txt
COPY backend/app /opt/omnira/backend/app
COPY web /opt/omnira/web
RUN useradd --create-home --uid 10001 omnira && mkdir -p /opt/omnira/data && chown -R omnira:omnira /opt/omnira/data
USER omnira
WORKDIR /opt/omnira/backend
EXPOSE 8000
CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
