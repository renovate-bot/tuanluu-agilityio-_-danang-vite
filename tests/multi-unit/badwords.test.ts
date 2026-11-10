import { test } from 'node:test';
import assert from 'node:assert/strict';
import { exIsBad } from '../../server/multi/src/badwords.ts';

test('tên thật không bị chặn nhầm', () => {
  for (const n of ['Đàm', 'Đàm Vĩnh', 'Buổi sáng', 'Bưởi', 'Các bạn', 'Lớn', 'lợn con', 'Grape', 'Dickson', 'Đầm Sen', 'Cácbon', 'Lona', 'Damian', 'Therapist', 'Long', 'Sexton'])
    assert.equal(exIsBad(n), false, n);
});

test('từ tục vẫn bị chặn', () => {
  for (const n of ['fuck', 'FuCk you', 'Đụ má', 'dit', 'đm', 'v.c.l', 'rape', 'dick', 'big dick', 'shit', 'cac', 'lon', 'buoi', 'LON', 'lồn', 'cặc', 'Thằng lồn', 'buồi', 'bitch', 'xfuckx'])
    assert.equal(exIsBad(n), true, n);
});
