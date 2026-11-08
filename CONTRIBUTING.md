# Hướng dẫn đóng góp

Cảm ơn bạn đã quan tâm đến **Các cây cầu Đà Nẵng 3D**! Mọi đóng góp — báo lỗi, đề xuất tính năng, cải thiện tài liệu, bản dịch hay code — đều được hoan nghênh. Tài liệu này giúp bạn bắt đầu nhanh và giúp việc review diễn ra suôn sẻ.

## Mục lục

- [Quy tắc ứng xử](#quy-tắc-ứng-xử)
- [Các cách đóng góp](#các-cách-đóng-góp)
- [Thiết lập môi trường](#thiết-lập-môi-trường)
- [Cấu trúc dự án](#cấu-trúc-dự-án)
- [Quy trình làm việc](#quy-trình-làm-việc)
- [Quy tắc bất biến của dự án](#quy-tắc-bất-biến-của-dự-án)
- [Kiểm thử](#kiểm-thử)
- [Quy ước commit](#quy-ước-commit)
- [Gửi Pull Request](#gửi-pull-request)
- [Báo lỗi và đề xuất tính năng](#báo-lỗi-và-đề-xuất-tính-năng)
- [Lỗ hổng bảo mật](#lỗ-hổng-bảo-mật)
- [Làm việc cùng AI agent](#làm-việc-cùng-ai-agent)
- [Giấy phép](#giấy-phép)

## Quy tắc ứng xử

Hãy tôn trọng và lịch sự với mọi người. Góp ý tập trung vào code và ý tưởng, không nhắm vào cá nhân. Những hành vi quấy rối, xúc phạm hay phân biệt đối xử sẽ không được chấp nhận.

## Các cách đóng góp

- **Báo lỗi** — mở issue bằng mẫu *Bug report*.
- **Đề xuất tính năng** — mở issue bằng mẫu *Feature request* và trao đổi trước khi bắt tay vào code với thay đổi lớn.
- **Cải thiện tài liệu** — sửa lỗi chính tả, làm rõ hướng dẫn, bổ sung ví dụ.
- **Bản dịch** — thêm hoặc chỉnh sửa chuỗi i18n (xem [quy tắc i18n](#quy-tắc-bất-biến-của-dự-án)).
- **Code** — sửa lỗi, tối ưu hiệu năng, thêm tính năng đã được thống nhất.

Nếu bạn mới tham gia, hãy bắt đầu với các issue nhỏ hoặc cải thiện tài liệu.

## Thiết lập môi trường

Yêu cầu: **Node.js** (khuyến nghị bản LTS mới) và **npm**.

```bash
# 1. Fork repo trên GitHub, sau đó clone fork của bạn
git clone https://github.com/<tai-khoan-cua-ban>/danang-vite.git
cd danang-vite

# 2. Cài đặt phụ thuộc
npm install

# 3. Chạy máy chủ phát triển
npm run dev
```

Các lệnh thường dùng:

| Lệnh | Mô tả |
| --- | --- |
| `npm run dev` | Chạy Vite dev server |
| `npm run build` | Kiểm tra kiểu (`tsc --noEmit`) rồi build production |
| `npm run preview` | Xem trước bản build |
| `npm run typecheck` | Chỉ kiểm tra kiểu TypeScript |
| `npm run gen:voice` | Sinh file giọng đọc thuyết minh |

> Các bài test dùng Playwright. Nếu chạy lần đầu, bạn có thể cần cài trình duyệt: `npx playwright install chromium`.

## Cấu trúc dự án

```
src/
├── audio/         # Âm thanh, giọng đọc
├── bridges/       # Mô hình từng cây cầu
├── common/        # Tiện ích dùng chung
├── config.ts      # Mọi thông số (kích thước, màu, vị trí…)
├── core/          # Lõi: cảnh, camera, vòng lặp
├── environment/   # Môi trường: sông, thành phố, thời tiết, ngày/đêm
├── i18n/          # Chuỗi dịch (9 ngôn ngữ)
├── main.ts        # Điểm vào, thứ tự dựng cảnh
├── styles/        # CSS
├── ui/            # Giao diện người dùng
└── views/         # Các góc nhìn / chế độ tham quan
scripts/           # Script hỗ trợ (vd. sinh giọng đọc)
tests/             # Các bài kiểm tra tự động
docs/superpowers/  # Spec (specs/) và plan (plans/) cho từng tính năng
```

## Quy trình làm việc

1. **Tìm hoặc tạo issue** mô tả việc bạn định làm để tránh trùng lặp.
2. **Fork** repo và tạo nhánh từ `main`:
   ```bash
   git checkout -b feat/ten-tinh-nang
   ```
   Đặt tên nhánh có tiền tố rõ nghĩa: `feat/`, `fix/`, `docs/`, `refactor/`, `perf/`, `test/`, `chore/`.
3. **Code** theo các quy tắc bên dưới, giữ thay đổi nhỏ và tập trung vào một mục đích.
4. **Chạy kiểm tra** (typecheck, build, các test liên quan).
5. **Commit** theo [quy ước commit](#quy-ước-commit) và push lên fork.
6. **Mở Pull Request** vào `main` và điền đầy đủ mẫu PR.

## Quy tắc bất biến của dự án

Đây là những ràng buộc kiến trúc mà mọi PR cần tuân thủ (cũng nằm trong checklist của mẫu PR):

- **Không đổi chuỗi `rand()` có seed.** Giữ nguyên thứ tự dựng trong `main.ts`. Nếu cần ngẫu nhiên mới, dùng `rng(seed)` riêng để không làm thay đổi cảnh hiện có.
- **Thông số mới đặt trong `src/config.ts`**, ghi rõ đơn vị và đánh dấu `(ước lượng)` hoặc nêu nguồn.
- **Khóa i18n mới phải có đủ 9 ngôn ngữ.** Không để thiếu bản dịch.
- **Không thêm thư viện runtime, ảnh ngoài hay đèn động.** Dự án giữ nhẹ và tự chứa; ánh sáng/hình ảnh được dựng bằng code.
- **Giữ ngân sách draw call.** Mọi thay đổi hình ảnh cần được đo bằng `npm run test:drawcalls` và so sánh với `tests/KET-QUA.md`.
- **TypeScript phải sạch lỗi** (`npm run typecheck`).

### Phong cách code

- Dùng TypeScript, tránh `any` khi không cần thiết.
- Đặt tên biến/hàm rõ nghĩa; chú thích bằng tiếng Việt hoặc tiếng Anh nhất quán trong cùng một file.
- Không đưa số "ma thuật" vào code — chuyển vào `config.ts`.
- Tái sử dụng hình học/vật liệu (geometry, material) khi có thể để giảm draw call và bộ nhớ.

## Kiểm thử

Chạy các test phù hợp với phần bạn thay đổi:

| Lệnh | Kiểm tra |
| --- | --- |
| `npm run test:tour` | Chế độ tham quan |
| `npm run test:voice` | Giọng đọc thuyết minh |
| `npm run test:drawcalls` | Số draw call ở các góc nhìn |
| `npm run test:tunnel` | Hầm / đường hầm |
| `npm run test:riverfront` | Bờ sông |
| `npm run test:weather` | Thời tiết |

Trước khi gửi PR, tối thiểu hãy chạy:

```bash
npm run typecheck
npm run build
```

Nếu bạn thay đổi hình ảnh, hãy kiểm tra cả cảnh **ban ngày** lẫn **ban đêm** và đính kèm ảnh chụp vào PR.

## Quy ước commit

Dự án khuyến khích [Conventional Commits](https://www.conventionalcommits.org/):

```
<loại>(phạm-vi): mô tả ngắn gọn
```

Ví dụ:

```
feat(bridges): thêm đèn LED cho cầu Rồng
fix(weather): sửa mưa không dừng khi đổi góc nhìn
docs: cập nhật hướng dẫn cài đặt
```

Các loại thường dùng: `feat`, `fix`, `docs`, `refactor`, `perf`, `test`, `chore`.

## Gửi Pull Request

- Mô tả **cái gì** thay đổi và **vì sao**; liên kết issue (`Closes #123`) hoặc spec/plan trong `docs/superpowers/` nếu có.
- Điền đủ checklist trong mẫu PR: typecheck/build, chênh lệch draw call, test liên quan, ảnh ngày/đêm.
- Cập nhật tài liệu liên quan (README, `tests/KET-QUA.md`) khi cần.
- Giữ PR nhỏ gọn; tách thay đổi lớn thành nhiều PR.
- Sẵn sàng phản hồi review và chỉnh sửa theo góp ý.

## Báo lỗi và đề xuất tính năng

Khi báo lỗi, hãy cung cấp:

- Các bước tái hiện lỗi
- Kết quả mong đợi và kết quả thực tế
- Trình duyệt, hệ điều hành, thiết bị (GPU nếu có thể)
- Ảnh chụp màn hình hoặc video, log console nếu có

Khi đề xuất tính năng, hãy nêu vấn đề cần giải quyết, giải pháp bạn hình dung và các phương án thay thế.

## Lỗ hổng bảo mật

**Đừng** công khai lỗ hổng bảo mật qua issue. Vui lòng làm theo hướng dẫn trong [SECURITY.md](SECURITY.md).

## Làm việc cùng AI agent

Nếu bạn dùng AI agent (Copilot, Claude, …) để hỗ trợ, hãy đọc [AGENTS.md](AGENTS.md) và các hướng dẫn trong thư mục [`.github/`](.github/) trước. Cuối phiên làm việc, cập nhật `.github/memory-bank/` (`activeContext.md`, `progress.md`, và `decisions.md` nếu có quyết định mới). Bạn vẫn chịu trách nhiệm xem lại và kiểm thử mọi thay đổi do AI tạo ra.

## Giấy phép

Bằng việc đóng góp, bạn đồng ý rằng đóng góp của mình được cấp phép theo [Giấy phép MIT](LICENSE) của dự án.
