# Taste: Việc (todo-v1)

## Direction

- **Users and use:** một người, vài lần mỗi ngày, trên máy tính và điện thoại.
- **The one thing they look at most:** việc nào đã quá hạn và việc nào tới hạn hôm nay.
- **Direction:** "Sổ tay": giấy ấm, tiêu đề serif kiểu biên tập (Fraunces), chữ Be Vietnam Pro, dòng gọn, một màu đỏ son cho hành động và việc quá hạn; giờ ở lề trái như sổ ghi chép.
- **References and what was taken from each:** không có; hướng A trong ba hướng BA dựng, người dùng chọn ngày 2026-11-26.
- **Themes:** sáng và tối, theo hệ thống.

## Tokens

| Token | Light | Dark |
|---|---|---|
| `--bg` | #f3eee4 | #191612 |
| `--paper` | #fbf8f2 | #221e19 |
| `--ink` | #1e1a15 | #efe8dc |
| `--muted` | #6a6256 | #ada393 |
| `--accent` | #b93a25 | #ef7a5c |
| `--accent-ink` | #ffffff | #1b120e |
| `--line` | #ddd3c3 | #3a332a |

- **Type:** Fraunces 600 cho tiêu đề và số đếm / Be Vietnam Pro 400, 600 cho chữ, từ `@fontsource/fraunces` và `@fontsource/be-vietnam-pro`; cỡ 13 / 15 / 22 / 26 / 44 (30 ở 390)
- **Spacing:** 4 / 8 / 12 / 16 / 24 / 28 / 48
- **Radius:** 3–4 cho ô và nút, 999 cho chip lọc ở 390
- **Motion:** không có

## Banned defaults

| id | Banned | Instead |
|---|---|---|
| B1 | Inter, Roboto, Arial or the system font as the face of the product | Fraunces + Be Vietnam Pro, embedded |
| B2 | Purple, indigo or blue-to-purple gradients; gradient text; glow | Flat colour from the tokens; vermilion only for the primary action and overdue. Errors: 13/600 ink with a 2px ink field border, under their field. Delete: muted, underlined |
| B3 | A grid of identical rounded cards | A ruled list, like a notebook |
| B4 | Everything centred, a narrow column with empty sides at 1440 | Three columns: rail, list, detail |
| B5 | Emoji as icons; icons in tinted tiles | Inline SVG check mark only |
| B6 | Lorem ipsum, "John Doe", "Acme", "Item 1" | Vietnamese tasks real people write |
| B7 | Pastel badges and tinted banners on everything | Colour only where it means something |
| B8 | Shadows on every surface, a card inside a card | Lines and paper tone, no shadows |
| B9 | Dark mode as inverted light | A warm dark surface with its own contrast |
| B10 | Oversized padding and type on a working screen | Compact rows; the time is shown once (margin at 1100px and up, under the title below) |
| B11 | Generic empty states with clip-art | An empty state that says what to do first |
