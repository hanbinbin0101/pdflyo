# ProPDF - PDF格式转换工具

ProPDF是一个基于Web的PDF格式转换工具，支持以下格式的相互转换：

- PDF转Word (DOCX)
- PDF转Excel (XLSX)
- PDF转PowerPoint (PPTX)
- Word转PDF
- Excel转PDF
- PowerPoint转PDF

## 功能特点

- 简洁直观的用户界面
- 拖放文件上传
- 实时转换进度显示
- 安全的文件处理（临时文件会自动删除）
- 支持大文件上传（最大10MB）

## 技术栈

- **前端**: HTML, CSS (Tailwind CSS), JavaScript
- **后端**: Node.js, Express
- **文件处理**: Multer
- **文档转换**: LibreOffice (命令行模式)

## 安装与运行

### 前提条件

1. 安装Node.js (推荐v14+)
2. 安装LibreOffice (用于文档转换)

### 安装步骤

1. 克隆仓库:

```bash
git clone https://github.com/yourusername/propdf.git
cd propdf
```

2. 安装依赖:

```bash
npm install
```

3. 确保LibreOffice已安装，并且`soffice`命令可用:

```bash
# 在Linux/Mac上
which soffice

# 在Windows上
where soffice
```

4. 启动服务器:

```bash
npm start
```

5. 访问应用:

在浏览器中打开 [http://localhost:3000](http://localhost:3000)

## 部署说明

### 在Linux服务器上部署

1. 安装必要的依赖:

```bash
sudo apt update
sudo apt install -y libreoffice nodejs npm
```

2. 配置反向代理 (使用Nginx):

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

3. 使用PM2运行应用:

```bash
npm install -g pm2
pm2 start server.js --name propdf
pm2 startup
pm2 save
```

## 使用说明

1. 在首页选择所需的转换功能
2. 点击上传按钮或拖放文件到上传区域
3. 等待转换完成
4. 点击下载按钮获取转换后的文件

## 注意事项

- 默认最大支持10MB的文件上传
- 转换速度取决于服务器配置和文档复杂度
- 转换后的Office文档可能与原始布局略有差异
- 部分特殊格式或嵌入内容可能无法正确转换

## 许可证

MIT 