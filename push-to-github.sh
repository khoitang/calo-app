#!/usr/bin/env bash
# Script đẩy project calo-app lên GitHub qua SSH
# Repository: git@github.com:khoitang/calo-app.git

set -e

echo "========================================"
echo "  Bắt đầu đẩy project lên GitHub (SSH)"
echo "========================================"
echo ""

# Khởi tạo git repo nếu chưa có
if [ ! -d .git ]; then
  echo "-> Khởi tạo git repository..."
  git init
  git branch -M main
else
  echo "-> Git repository đã tồn tại."
fi

# Thêm/cập nhật remote origin
if git remote get-url origin > /dev/null 2>&1; then
  echo "-> Cập nhật remote 'origin'..."
  git remote set-url origin git@github.com:khoitang/calo-app.git
else
  echo "-> Thêm remote 'origin'..."
  git remote add origin git@github.com:khoitang/calo-app.git
fi

echo ""
echo "-> Thêm tất cả file..."
git add .

echo "-> Commit..."
if git diff --cached --quiet; then
  echo "   (Không có thay đổi mới để commit)"
else
  git commit -m "Initial commit: calo-app"
fi

echo ""
echo "-> Đẩy lên GitHub..."
git push -u origin main

echo ""
echo "========================================"
echo "  ĐÃ ĐẨY XONG!"
echo "  Truy cập: https://github.com/khoitang/calo-app"
echo "========================================"
