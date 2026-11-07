# Memory Bank

Bộ nhớ dài hạn của dự án cho AI agent. Agent mất toàn bộ ngữ cảnh giữa các phiên; các file ở đây là thứ duy nhất nối phiên này với phiên sau. Giữ chúng **đúng và ngắn** quan trọng hơn giữ chúng đầy đủ.

## Các file và thứ tự phụ thuộc

```
projectbrief.md ──► productContext.md ──┐
        │                               ├──► activeContext.md ──► progress.md
        ├──► systemPatterns.md ─────────┤
        └──► techContext.md ────────────┘
                     decisions.md  (nhật ký quyết định, ghi thêm, không sửa mục cũ)
```

| File | Chứa gì | Đổi khi nào | Đọc khi nào |
|---|---|---|---|
| `projectbrief.md` | Mục tiêu, phạm vi, tiêu chí thành công | Hiếm khi | Phiên đầu tiên; khi nghi ngờ phạm vi |
| `productContext.md` | Người dùng, trải nghiệm, nguyên tắc nội dung (chính xác, ước lượng, văn hóa) | Khi thêm công trình / tính năng lớn | Khi làm nội dung, UI, thuyết minh |
| `systemPatterns.md` | Kiến trúc, mẫu code, cạm bẫy | Khi phát hiện / tạo mẫu mới | Trước khi viết code mới |
| `techContext.md` | Công cụ, lệnh, môi trường, giới hạn kỹ thuật | Khi đổi phụ thuộc, script, môi trường | Khi build/test lỗi; khi thêm script |
| `activeContext.md` | **Đang làm gì, bước tiếp theo, vấn đề mở** | **Mỗi phiên** | **Luôn đọc đầu phiên** |
| `progress.md` | Đã xong / còn thiếu / lỗi đã biết theo từng tính năng | Khi xong một bước | **Luôn đọc đầu phiên** |
| `decisions.md` | Quyết định kiến trúc (ADR rút gọn) | Khi chọn giữa các phương án | Trước khi đề xuất đổi kiến trúc |

## Quy tắc cập nhật

1. **Sự thật, không phải ý định.** Chỉ ghi "xong" khi đã chạy kiểm tra và thấy kết quả. Ghi ngày tuyệt đối (YYYY-MM-DD), không ghi "hôm qua".
2. **Không lặp lại thứ code/README/git đã nói.** Ghi *vì sao*, *trạng thái*, *cạm bẫy*. Trỏ tới file bằng đường dẫn thay vì chép code.
3. **Ngắn.** `activeContext.md` dưới ~60 dòng. Việc đã xong chuyển sang `progress.md`; chi tiết đã cũ thì xóa.
4. **Sửa chỗ sai ngay.** Thấy ghi chú mâu thuẫn với code → tin code, sửa ghi chú.
5. **`decisions.md` chỉ ghi thêm.** Quyết định bị thay thì thêm mục mới, đánh dấu mục cũ `Thay bởi D-xxx`.

Spec và plan của từng tính năng nằm ngoài memory bank, ở `docs/superpowers/`; memory bank trỏ tới chúng, không chép lại.

Cập nhật toàn bộ: chạy prompt [update-memory-bank](../prompts/update-memory-bank.prompt.md).
