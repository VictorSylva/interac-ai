FROM python:3.11-slim

WORKDIR /app

# Install system dependencies required by OpenCV and curl for health checks
RUN apt-get update && apt-get install -y --no-install-recommends \
    libglib2.0-0 \
    libgthread-2.0-0 \
    libgl1 \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . /app
RUN python compile_proto.py

ENV PYTHONPATH=/app
ENV PYTHONUNBUFFERED=1

EXPOSE 8001

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001"]
