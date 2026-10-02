# Phả Hệ Gia Đình – bản responsive

Bản này giữ logic phả hệ và xưng hô, đồng thời tối ưu bố cục:
- Nhóm anh/chị/em chỉ dài theo đúng nhóm con, không kéo theo toàn canvas.
- Vợ/chồng của người con không làm lệch tâm nhóm anh/chị/em.
- Cặp cha mẹ tự căn theo trung điểm nhóm con.
- Khoảng cách giữa các family unit được thu gọn.
- Mobile dùng card nhỏ hơn, thanh điều khiển gọn hơn và tự căn/fit sơ đồ khi mở.
- Kéo canvas bằng một ngón và chụm/zoom vẫn hoạt động.
- Vị trí thủ công dùng khóa v3 để không bị các tọa độ cũ làm phình sơ đồ.

## Google Login + đồng bộ PC/điện thoại
Bản này đã tích hợp sẵn luồng Firebase Authentication (Google) + Firestore, nhưng để đăng nhập thật bạn phải tạo một Firebase Web App riêng và điền cấu hình vào `firebase-config.js`.

1. Tạo project Firebase.
2. Authentication → Sign-in method → bật Google.
3. Firestore Database → tạo database.
4. Project settings → Your apps → Web app → copy config vào `firebase-config.js`.
5. Trong Firestore Rules, dùng quy tắc cơ bản sau (thay đổi theo nhu cầu bảo mật của bạn):

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

Sau khi cấu hình, cùng một Google Account trên PC và điện thoại sẽ dùng cùng dữ liệu trong `users/{uid}`.
