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
- **文档转换**:
  - **本地环境**: LibreOffice (命令行模式)
  - **Vercel环境**: Cloudmersive API

## 安装与运行

### 前提条件

1. 安装Node.js (推荐v14+)
2. 本地开发需要安装LibreOffice (用于文档转换)
3. Vercel部署需要Cloudmersive API密钥

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

3. 本地开发时，确保LibreOffice已安装，并且`soffice`命令可用:

```bash
# 在Linux/Mac上
which soffice

# 在Windows上
where soffice
```

4. 创建环境变量文件:

```bash
# 创建.env文件
cp .env.example .env
# 编辑.env文件，填入Cloudmersive API密钥
```

5. 启动服务器:

```bash
npm start
```

6. 访问应用:

在浏览器中打开 [http://localhost:8080](http://localhost:8080)

## Vercel部署说明

### 1. 准备工作

1. 注册[Cloudmersive API](https://cloudmersive.com/)账号并获取API密钥
2. 在[Vercel](https://vercel.com/)注册账号并连接到您的GitHub仓库

### 2. 配置环境变量

在Vercel项目设置中，添加以下环境变量:

- `CLOUDMERSIVE_API_KEY` - 您的Cloudmersive API密钥

### 3. 部署项目

1. 确保您的项目包含正确的`vercel.json`配置文件
2. 通过Vercel控制台部署项目，或推送代码到GitHub触发自动部署

### 4. 验证部署

1. 部署完成后，使用simple-test.html页面测试API连接状态
2. 检查您的Cloudmersive API配额和使用情况

### 注意事项

- Vercel环境中无法使用LibreOffice，必须使用Cloudmersive API
- Cloudmersive API有调用限制，请注意控制使用量
- Vercel的Serverless函数有执行时间限制，大文件可能会超时

## 本地开发与Vercel部署的区别

| 功能 | 本地开发 | Vercel部署 |
|------|---------|------------|
| 文档转换 | LibreOffice | Cloudmersive API |
| 临时文件存储 | 本地文件系统 | /tmp目录 (有限制) |
| 运行环境 | 长时间运行的服务器 | Serverless函数 |
| 执行时间限制 | 无限制 | 最大300秒 |
| API密钥要求 | 可选 | 必需 |

## 故障排除

### Vercel部署问题

1. **API连接错误**:
   - 检查环境变量是否正确配置
   - 使用simple-test.html页面测试API状态
   - 查看Vercel日志获取详细错误信息

2. **文件转换失败**:
   - 确认Cloudmersive API密钥有效且未达到使用限制
   - 检查上传的文件大小和格式是否符合要求
   - 大文件可能需要增加函数超时时间(在vercel.json中配置)

3. **上传错误**:
   - 检查文件上传大小限制
   - 确认文件格式兼容性
   - 检查Vercel临时存储空间限制

## 许可证

MIT 