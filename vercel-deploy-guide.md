# ProPDF Vercel部署指南

## 部署问题排查

在Vercel平台部署PDF转换应用时可能会遇到以下问题：

1. 上传错误："服务器连接失败或处理请求时出错"
2. PDF转换失败: "在Vercel环境中不支持LibreOffice转换"
3. API连接错误

## 解决方案

### 1. 确保环境变量配置正确

Vercel部署需要配置Cloudmersive API密钥，这是在Vercel环境中进行文档转换的必要条件。

1. 注册[Cloudmersive](https://cloudmersive.com/)账号并获取API密钥
2. 在Vercel项目设置中添加环境变量:
   - 变量名: `CLOUDMERSIVE_API_KEY`
   - 变量值: 您的Cloudmersive API密钥

![Vercel环境变量设置](https://example.com/vercel-env-vars.png)

### 2. 确保vercel.json配置正确

当前的vercel.json配置已经设置了适当的内存和超时限制：

```json
{
  "version": 2,
  "builds": [
    {
      "src": "server.js",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "server.js"
    }
  ],
  "functions": {
    "server.js": {
      "memory": 3008,
      "maxDuration": 300
    }
  },
  "env": {
    "NODE_ENV": "production"
  }
}
```

这些设置保证：
- Serverless函数有足够的内存(3008MB)
- 转换大文件有足够的时间(最大300秒)

### 3. 使用相对路径进行API请求

确保所有HTML文件中的API请求使用相对路径：

正确:
```javascript
fetch('/api/convert', { ... })
```

错误:
```javascript
fetch('http://localhost:8080/api/convert', { ... })
```

### 4. 部署验证

1. 推送代码到GitHub仓库，Vercel将自动部署
2. 部署完成后，访问simple-test.html页面测试API连接状态
3. 使用诊断功能检查环境配置:
   - 访问`https://your-vercel-domain/simple-test.html`
   - 点击"检查API状态"按钮
   - 验证API密钥是否配置成功

### 5. 常见问题排查

#### 问题: 服务器连接失败
- 检查网络连接
- 确认部署是否完成
- 查看Vercel日志检查服务器错误

#### 问题: API密钥未配置
- 确认在Vercel项目设置中添加了CLOUDMERSIVE_API_KEY
- 密钥格式是否正确
- 账户是否有足够的API调用额度

#### 问题: 文件转换失败
- 检查文件大小是否超过限制(10MB)
- 确认文件格式是否支持
- 增加Serverless函数超时时间(如果需要)

### 6. 测试工作流程

1. 在本地环境测试应用，确保功能正常
2. 推送代码到GitHub
3. Vercel自动部署应用
4. 使用simple-test.html进行部署验证
5. 进行实际文件转换测试

## 技术限制

在Vercel环境中存在以下技术限制：

1. 无法使用本地安装的LibreOffice
2. Serverless函数有执行时间限制
3. 临时存储(/tmp目录)有大小限制
4. API请求有超时限制

## 成功部署标准

成功部署的标准是:

1. 能够通过simple-test.html页面连接到API
2. API诊断显示环境变量已正确配置
3. 能够成功上传和转换文档
4. 下载转换后的文件正常 