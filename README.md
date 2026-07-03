
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

## 5. CI/CD — GitHub Actions

Hai workflow trong `.github/workflows/` tự chạy khi push lên `main`:

| Workflow | Kích hoạt khi đổi | Việc làm |
|----------|-------------------|----------|
| `deploy-backend.yml`  | `backend/**`  | `go vet`/`build` → build Docker → push lên **ECR** (tag `latest` + git SHA) |
| `deploy-frontend.yml` | `frontend/**` | `aws s3 sync` lên **S3** → (tuỳ chọn) invalidate CloudFront |

### Xác thực bằng OIDC (không cần access key)

Workflow assume IAM role `arn:aws:iam::028708951757:role/GitHub-CI-ECR` qua OIDC — GitHub tự lấy token tạm thời, **không lưu access key** trong repo.

Điều kiện để role hoạt động (làm 1 lần trong AWS):

1. Tạo **OIDC provider** cho GitHub trong IAM (nếu chưa có):
   - Provider URL: `https://token.actions.githubusercontent.com`
   - Audience: `sts.amazonaws.com`
2. **Trust policy** của role cho phép repo này assume:
   ```json
   {
     "Effect": "Allow",
     "Principal": { "Federated": "arn:aws:iam::028708951757:oidc-provider/token.actions.githubusercontent.com" },
     "Action": "sts:AssumeRoleWithWebIdentity",
     "Condition": {
       "StringEquals": { "token.actions.githubusercontent.com:aud": "sts.amazonaws.com" },
       "StringLike": { "token.actions.githubusercontent.com:sub": "repo:seta-nguyenhieu7227/demo:*" }
     }
   }
   ```
3. **Permission policy** của role: `ecr:*` (push/create-repo), `s3:PutObject/DeleteObject/ListBucket` trên bucket, và `cloudfront:CreateInvalidation` nếu dùng CloudFront.

**Sửa trong file workflow** cho khớp tài khoản (phần `env:` ở đầu mỗi file):
- `AWS_REGION` — ví dụ `ap-southeast-1`
- `AWS_ROLE_ARN` — role assume qua OIDC (đang là role ở trên)
- `ECR_REPOSITORY` — tên repo ECR (workflow tự tạo nếu chưa có)
- `S3_BUCKET` — tên bucket FE

**Variable tuỳ chọn** (Settings → Secrets and variables → Actions → *Variables*):

| Variable | Ý nghĩa |
|----------|---------|
| `CLOUDFRONT_DISTRIBUTION_ID` | Có thì FE deploy xong sẽ tự invalidate cache |

### Chạy tay

Cả hai workflow có `workflow_dispatch` → vào tab **Actions** bấm **Run workflow** để deploy thủ công.

---

## Kiểm tra nhanh

```bash
curl localhost:8080/health
curl -X POST localhost:8080/api/todos -d '{"title":"Học Go"}'
curl localhost:8080/api/todos
```
