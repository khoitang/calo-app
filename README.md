# Calo Ngày

Web app (PWA) ghi nhật ký calo hằng ngày, tối ưu cho điện thoại. Có tài khoản riêng cho từng người, đăng nhập bằng email + mật khẩu hoặc Google. Dữ liệu lưu trên server tự host và vẫn mở được offline sau lần đăng nhập đầu.

## Tính năng

- Tính BMR (Mifflin–St Jeor), TDEE và mục tiêu calo theo cân nặng, chiều cao, tuổi, giới, mức vận động.
- Chia mục tiêu thành đạm / tinh bột / chất béo.
- Nhật ký 4 bữa: sáng, trưa, tối, ăn vặt.
- Thư viện 34 món Việt Nam + món tự thêm (số liệu trên 100g, khẩu phần gợi ý).
- Tìm kiếm không dấu, món gần đây, chỉnh khẩu phần bằng gram, chép bữa hôm qua.
- Tài khoản email/mật khẩu hoặc Google; mỗi tài khoản có dữ liệu riêng.
- Tự đồng bộ giữa các thiết bị, có cache offline và tự đẩy thay đổi khi có mạng lại.
- Xuất / nhập file JSON để sao lưu và khôi phục.
- Cài được lên màn hình chính (PWA), dùng offline sau lần tải đầu.

## Yêu cầu

- Node.js 22.5+ (đã test với Node 26). Server dùng `node:sqlite` có sẵn, không cần cài database riêng.
- Trình duyệt hiện đại. Service worker chỉ chạy trên `localhost` hoặc HTTPS.

## Chạy ở máy

```bash
npm install
cp .env.example .env   # không bắt buộc nếu chưa dùng Google
npm run dev            # API :8787 + web :5173
```

Mở http://localhost:5173. Lệnh `npm run dev` chạy đồng thời server API và Vite; Vite proxy `/api` sang cổng API nên cookie phiên hoạt động như cùng một origin.

Build và chạy bản production:

```bash
npm run build
npm start              # mặc định http://localhost:8787
```

`npm start` phục vụ cả frontend trong `dist` và API trên cùng một cổng.

Mở trên điện thoại trong cùng mạng LAN:

```bash
npm run dev -- --host
# mở http://<IP-máy-tính>:5173
```

## Cấu hình (.env khi dev / biến môi trường khi deploy)

| Biến | Mặc định | Mô tả |
| --- | --- | --- |
| `PORT` | `8787` | Cổng server API (production phục vụ luôn frontend). |
| `APP_URL` | dev `http://localhost:5173` | URL trình duyệt dùng để mở app. Phải khớp origin thật khi deploy. |
| `GOOGLE_CLIENT_ID` | trống | OAuth Client ID của Google. |
| `GOOGLE_CLIENT_SECRET` | trống | OAuth Client Secret của Google. |
| `GOOGLE_REDIRECT_URI` | `<APP_URL>/api/auth/google/callback` | Chỉ đặt nếu muốn redirect URI khác. |
| `DB_PATH` | `server/data/calo.db` | Đường dẫn file SQLite. |
| `SESSION_DAYS` | `30` | Số ngày phiên đăng nhập được giữ. |

Các biến `GOOGLE_AUTH_URL`, `GOOGLE_TOKEN_URL`, `GOOGLE_USERINFO_URL` chỉ dùng khi test OAuth bằng mock server; bình thường không cần đặt.

### Tạo Google OAuth Client

1. Vào [Google Cloud Console](https://console.cloud.google.com/) → tạo hoặc chọn project.
2. **APIs & Services → OAuth consent screen**: chọn External, điền tên app và email hỗ trợ. Khi còn ở chế độ Testing, thêm email của bạn vào **Test users**.
3. **APIs & Services → Credentials → Create credentials → OAuth client ID → Web application**.
4. **Authorized JavaScript origins**: thêm `APP_URL` (ví dụ `http://localhost:5173`).
5. **Authorized redirect URIs**: thêm chính xác
   - Dev: `http://localhost:5173/api/auth/google/callback`
   - Production: `https://your-domain.com/api/auth/google/callback`
6. Copy Client ID / Client Secret vào `.env` rồi khởi động lại server.

Nếu chưa cấu hình Google, nút Google vẫn hiện nhưng báo “chưa được cấu hình”; đăng nhập bằng mật khẩu vẫn hoạt động bình thường.

## Deploy

App cần một host chạy Node thường trực và giữ được file SQLite, ví dụ VPS, Render (gắn persistent disk), Railway (volume), Fly.io (volume). Không deploy chỉ thư mục `dist` lên hosting tĩnh vì sẽ mất API và đăng nhập.

Checklist production:

```bash
npm ci
npm run build
NODE_ENV=production \
APP_URL=https://your-domain.com \
PORT=8080 \
DB_PATH=/data/calo.db \
GOOGLE_CLIENT_ID=... \
GOOGLE_CLIENT_SECRET=... \
npm start
```

- Dùng HTTPS. Khi `APP_URL` bắt đầu bằng `https://`, cookie phiên tự thêm `Secure`.
- `APP_URL` phải là origin thật (không có dấu `/` cuối) để kiểm tra same-origin và tạo redirect Google đúng.
- Đặt `DB_PATH` trên volume/disk bền vững. Sao lưu định kỳ file `.db` (cùng file `-wal` nếu đang chạy).
- Nếu chạy sau reverse proxy, chuyển tiếp `X-Forwarded-For` để rate limit theo IP hoạt động đúng.
- Chỉ chạy một instance ghi vào cùng file SQLite, hoặc chuyển sang database dùng chung nếu cần scale ngang.
- Đặt `NODE_ENV=production` để server không đọc `.env` và dùng biến môi trường của nền tảng.

## Kiến trúc

```
server/index.js           Node http server + SQLite (auth, data API, static)
scripts/dev.mjs           chạy API --watch + Vite cùng lúc
scripts/start.mjs         chạy production
src/
  App.tsx                 khung app + tab
  Root.tsx                chặn app khi chưa đăng nhập
  data/seedFoods.ts       dữ liệu món có sẵn
  lib/
    api.ts                client gọi API + thông báo lỗi tiếng Việt
    auth.tsx              AuthProvider, phiên đăng nhập, fallback offline
    cache.ts              cache dữ liệu theo từng user
    store.tsx             state, hydrate từ server, debounce + retry khi offline
    calc.ts               BMR, TDEE, mục tiêu calo, macro
    logs.ts               truy vấn nhật ký
    backup.ts             xuất/nhập JSON
    date.ts, meals.ts     tiện ích ngày và bữa
  components/
    AuthScreen.tsx        đăng nhập / đăng ký / Google
    Onboarding.tsx        tạo hồ sơ lần đầu
    TodayView.tsx         màn hình hôm nay
    AddFoodSheet.tsx      chọn món + khẩu phần
    EditEntrySheet.tsx    sửa/xoá mục đã ghi
    LibraryView.tsx       thư viện món
    FoodFormSheet.tsx     thêm/sửa món tự tạo
    ProfileForm.tsx       hồ sơ + kết quả tính
    ProfileView.tsx       tài khoản, hồ sơ + sao lưu
```

### API

| Method | Đường dẫn | Mô tả |
| --- | --- | --- |
| `POST` | `/api/auth/register` | Tạo tài khoản email + mật khẩu. |
| `POST` | `/api/auth/login` | Đăng nhập email + mật khẩu. |
| `POST` | `/api/auth/logout` | Xoá phiên hiện tại. |
| `GET` | `/api/auth/me` | User hiện tại hoặc `null`. |
| `GET` | `/api/auth/google` | Bắt đầu OAuth với Google. |
| `GET` | `/api/auth/google/callback` | Google redirect về, tạo/liên kết tài khoản. |
| `GET` | `/api/data` | Lấy dữ liệu của user đang đăng nhập. |
| `PUT` | `/api/data` | Ghi đè dữ liệu của user đang đăng nhập. |
| `GET` | `/api/health` | Kiểm tra server sống. |

## Bảo mật & dữ liệu

- Mật khẩu băm bằng `scrypt` với salt ngẫu nhiên; không lưu mật khẩu gốc.
- Phiên dùng token ngẫu nhiên 256-bit, chỉ lưu bản hash SHA-256 trong SQLite, gửi qua cookie `HttpOnly; SameSite=Lax` (thêm `Secure` khi HTTPS). Token hết hạn sau `SESSION_DAYS` ngày.
- API yêu cầu JSON và kiểm tra same-origin cho thao tác ghi; có rate limit cho đăng ký/đăng nhập.
- Mỗi user có một bản ghi `user_data` riêng. API luôn lấy user từ phiên, không nhận `userId` từ client.
- Google OAuth dùng authorization code + state cookie. Chỉ liên kết với tài khoản email sẵn có khi Google xác nhận `email_verified`.
- Tài khoản tạo bằng Google không có mật khẩu; đăng nhập mật khẩu sẽ báo dùng Google. Nếu sau đó liên kết Google vào tài khoản mật khẩu, cả hai cách đều dùng được.
- Client lưu cache dữ liệu theo `user.id` để offline. Khi có mạng, bản mới hơn (theo `updatedAt`) thắng; thay đổi offline được đẩy lên khi online lại. Đăng xuất xoá cache của user đó.
- Service worker không cache `/api/*`.
- Dữ liệu cũ từ phiên bản chỉ dùng localStorage (`calo-ngay.v1`) được chuyển vào tài khoản đầu tiên đăng nhập trên máy đó, sau đó xoá key cũ.
- Vào **Hồ sơ → Xuất file** để sao lưu. File JSON có thể nhập lại ở tab Hồ sơ hoặc ngay màn hình onboarding.
- Số liệu dinh dưỡng mang tính tham khảo (USDA + bảng thành phần dinh dưỡng Việt Nam, đã làm tròn). Món nấu tại nhà nên cân nguyên liệu để chính xác hơn.
- App không thay thế tư vấn y tế.

## Công thức

```
BMR (nam)  = 10×kg + 6.25×cm − 5×tuổi + 5
BMR (nữ)   = 10×kg + 6.25×cm − 5×tuổi − 161
TDEE       = BMR × hệ số vận động (1.2 → 1.9)
Mục tiêu   = TDEE ± mức thâm hụt/thặng dư (mặc định 400 kcal)
Đạm        = 1.6 g/kg cân nặng
Béo        = 25% tổng calo
Carb       = phần calo còn lại
```

## Hướng phát triển tiếp

- Quét barcode (Open Food Facts) cho đồ đóng gói.
- Theo dõi cân nặng theo tuần và biểu đồ xu hướng.
- Đổi / đặt lại mật khẩu, xác minh email.
- Ghi hoạt động thể thao để cộng calo tiêu hao.
- Ảnh món ăn + AI ước lượng khẩu phần (chỉ nên làm sau khi luồng nhập tay đã mượt).
