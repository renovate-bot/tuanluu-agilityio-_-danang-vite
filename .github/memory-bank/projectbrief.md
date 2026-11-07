# Project Brief

## Mục tiêu
Mô hình 3D tương tác, chạy trong trình duyệt, về các công trình vượt sông Hàn (Đà Nẵng), **bám thông số thật** và đủ đẹp để giới thiệu thành phố: góc nhìn có sẵn, Tour bay tự động có thuyết minh, ngày/đêm, mô phỏng vận hành (Cầu Rồng phun lửa/nước, Cầu sông Hàn quay, dìm đốt hầm).

## Phạm vi hiện tại
| Công trình | Trạng thái thật | Thư mục |
|---|---|---|
| Cầu Rồng | Đã xây (2013) | `src/bridges/dragon/` |
| Cầu Thuận Phước | Đã xây (2009) | `src/bridges/thuan-phuoc/` |
| Cầu Trần Thị Lý | Đã xây (2013) | `src/bridges/tran-thi-ly/` |
| Cầu sông Hàn (cầu quay) | Đã xây (2000) | `src/bridges/song-han/` |
| Hầm vượt sông Hàn | **Phương án đề xuất 2025, chưa xây** | `src/bridges/han-tunnel/` |
| Hai bờ sông (địa danh, LED trái tim, quảng cáo) | Cảnh thật | `src/environment/riverfront/` |

Ngoài phạm vi: bản đồ toàn thành phố, vật lý giao thông thật, backend, tài khoản người dùng.

## Tiêu chí thành công
- Không lệch bản gốc: draw call bằng bảng trong `tests/KET-QUA.md` (hoặc trong ngưỡng prompt cho phép), vị trí nhà/cây/xe giữ nguyên.
- Thông số thật có nguồn; chỗ tự thiết kế ghi `(ước lượng)`.
- Chạy mượt trên máy phổ thông; build tĩnh chạy được ở thư mục con (GitHub Pages, `base: './'`).
- Giao diện đủ 9 ngôn ngữ; thuyết minh có ít nhất vi + en.

## Nguồn sự thật
- Thông số: `src/config.ts`.
- Spec và plan từng tính năng: `docs/superpowers/specs/` và `docs/superpowers/plans/`.
- Hướng dẫn người dùng/nhà phát triển: `README.md`.
