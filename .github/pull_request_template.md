## Thay đổi

<!-- Tóm tắt; link spec/plan trong docs/superpowers/ nếu có -->

## Kiểm tra

- [ ] `npm run typecheck` / `npm run build` không lỗi
- [ ] `npm run test:drawcalls` — chênh lệch so với `tests/KET-QUA.md`: <!-- dán bảng các góc nhìn có chênh, hoặc "0 ở mọi góc" -->
- [ ] Test liên quan: <!-- test:tour / test:tunnel / test:voice / test:… -->
- [ ] Đã xem ảnh chụp ngày + đêm (nếu đổi hình ảnh)

## Bất biến

- [ ] Không đổi chuỗi `rand()` có seed (thứ tự dựng trong `main.ts` giữ nguyên; ngẫu nhiên mới dùng `rng(seed)`)
- [ ] Thông số mới nằm trong `src/config.ts`, có đơn vị và `(ước lượng)`/nguồn
- [ ] Khóa i18n mới có đủ 9 ngôn ngữ
- [ ] Không thêm thư viện runtime, đèn động
- [ ] Mô hình / texture ngoài (nếu có): giấy phép cho phân phối lại, đã ghi nguồn + tệp `LICENSE-*`, có trần dung lượng và đường lùi khi tải lỗi
- [ ] Đã cập nhật `.github/memory-bank/` (`activeContext.md`, `progress.md`, `decisions.md` nếu có quyết định mới)
- [ ] README / `tests/KET-QUA.md` cập nhật nếu cần
