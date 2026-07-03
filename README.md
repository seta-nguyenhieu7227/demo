
## 2. Database — AWS RDS (Postgres)

1. RDS → **Create database** → Engine **PostgreSQL**.
2. Đặt master user/password, DB name = `todo`.
3. **Public access**: bật nếu backend chạy ngoài VPC (demo). Production nên để private + backend cùng VPC.
4. Security Group: mở port **5432** cho IP/Security Group của backend.
5. Tạo bảng:
   ```bash
   psql "postgres://USER:PASS@<rds-endpoint>:5432/todo?sslmode=require" -f backend/schema.sql
   ```

## 3. Backend — deploy

`DATABASE_URL` trỏ tới RDS, ví dụ:
```
postgres://todoadmin:pass@my-db.abc123.ap-southeast-1.rds.amazonaws.com:5432/todo?sslmode=require
```

Vài cách chạy (chọn 1):

- **EC2**: `scp` binary lên, chạy dưới systemd, set env `DATABASE_URL`, `ALLOWED_ORIGIN`, `PORT`.
- **Docker / ECS / App Runner**:
  ```bash
  cd backend
  docker build -t todo-api .
  docker run -p 8080:8080 -e DATABASE_URL="..." -e ALLOWED_ORIGIN="http://<bucket>.s3-website-<region>.amazonaws.com" todo-api
  ```

Đặt `ALLOWED_ORIGIN` = đúng URL S3 website để CORS an toàn (khi test có thể để `*`).

> Lưu ý: S3 website là **HTTP**. Nếu backend chạy **HTTPS**, trình duyệt sẽ chặn mixed-content.
> Để production chuẩn: đặt **CloudFront** trước cả S3 và API (hoặc API sau ALB có HTTPS), rồi dùng HTTPS cho cả hai.

## 4. Frontend — S3 static website

1. Sửa `frontend/config.js`:
   ```js
   window.API_BASE = "http://<backend-host>:8080";
   ```
2. Tạo bucket, bật **Static website hosting** (index document = `index.html`).
3. Upload:
   ```bash
   aws s3 sync frontend/ s3://<ten-bucket>/ --acl public-read
   ```
   (hoặc tắt "Block public access" + thêm bucket policy cho `s3:GetObject`.)
4. Mở URL: `http://<ten-bucket>.s3-website-<region>.amazonaws.com`.

---

## Kiểm tra nhanh

```bash
curl localhost:8080/health
curl -X POST localhost:8080/api/todos -d '{"title":"Học Go"}'
curl localhost:8080/api/todos
```
