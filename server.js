// 加载环境变量
require('dotenv').config();

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { exec, spawn } = require('child_process');
const { v4: uuidv4 } = require('uuid');
const pdfParse = require('pdf-parse');
const XLSX = require('xlsx');
const docx = require('docx');
const pptxgenjs = require('pptxgenjs');
const { PDFDocument } = require('pdf-lib');
const PDF2Json = require('pdf2json');
// 添加Cloudmersive API客户端
const CloudmersiveConvertApiClient = require('cloudmersive-convert-api-client');

const app = express();
const port = process.env.PORT || 8080;

// 配置Cloudmersive API客户端
const cloudmersiveClient = CloudmersiveConvertApiClient.ApiClient.instance;
// 配置API密钥
const apiKey = cloudmersiveClient.authentications['Apikey'];
apiKey.apiKey = process.env.CLOUDMERSIVE_API_KEY;
console.log('Cloudmersive API密钥已配置:', process.env.CLOUDMERSIVE_API_KEY ? '成功' : '失败');

// 添加CORS支持
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  
  // 处理预检请求
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  
  next();
});

// 设置静态文件服务
app.use(express.static(path.join(__dirname, '/')));

// 配置文件上传的存储
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // 使用/tmp目录以兼容Vercel环境
    const uploadDir = process.env.VERCEL ? '/tmp/uploads' : path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // 生成唯一文件名，避免文件名冲突
    const uniqueId = uuidv4();
    cb(null, uniqueId + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 限制文件大小为 10MB
  fileFilter: (req, file, cb) => {
    // 检查文件类型
    const allowedExtensions = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx'];
    const ext = path.extname(file.originalname).toLowerCase();
    
    if (allowedExtensions.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('不支持的文件类型'));
    }
  }
});

// 创建转换文件的目录
const outputDir = process.env.VERCEL ? '/tmp/converted' : path.join(__dirname, 'converted');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// 文件上传和转换的API端点
app.post('/api/convert', upload.single('file'), async (req, res) => {
  try {
    console.log('收到文件上传请求');
    
    if (!req.file) {
      console.log('没有收到文件');
      return res.status(400).json({ success: false, message: '没有上传文件' });
    }

    // 添加Vercel环境检测
    if (process.env.VERCEL) {
      console.log('运行在Vercel环境中，API密钥状态:', process.env.CLOUDMERSIVE_API_KEY ? '已配置' : '未配置');
    }

    console.log('文件上传成功:', req.file.originalname);
    console.log('文件保存路径:', req.file.path);
    console.log('文件大小:', req.file.size, '字节');
    console.log('文件类型:', req.file.mimetype);

    const { conversionType } = req.body;
    console.log('请求的转换类型:', conversionType);
    
    if (!conversionType) {
      console.log('未指定转换类型');
      return res.status(400).json({ success: false, message: '未指定转换类型' });
    }

    // 检查转换类型是否支持
    const supportedTypes = [
      'pdf-to-word', 'pdf-to-excel', 'pdf-to-ppt',
      'word-to-pdf', 'excel-to-pdf', 'ppt-to-pdf'
    ];
    
    if (!supportedTypes.includes(conversionType)) {
      console.log('不支持的转换类型:', conversionType);
      return res.status(400).json({ 
        success: false, 
        message: `不支持的转换类型: ${conversionType}。支持的类型: ${supportedTypes.join(', ')}` 
      });
    }

    const uploadedFilePath = req.file.path;
    const fileExtension = path.extname(req.file.originalname).toLowerCase();
    
    // 验证文件扩展名与转换类型匹配
    const conversionMap = {
      'pdf-to-word': ['.pdf'],
      'pdf-to-excel': ['.pdf'],
      'pdf-to-ppt': ['.pdf'],
      'word-to-pdf': ['.doc', '.docx'],
      'excel-to-pdf': ['.xls', '.xlsx'],
      'ppt-to-pdf': ['.ppt', '.pptx']
    };
    
    const allowedExtensions = conversionMap[conversionType] || [];
    if (!allowedExtensions.includes(fileExtension)) {
      console.error(`文件扩展名不匹配: ${fileExtension}, 期望: ${allowedExtensions.join('或')}`);
      
      // 删除上传的文件
      try {
        fs.unlinkSync(uploadedFilePath);
      } catch (e) {
        console.warn(`无法删除不匹配的文件: ${e.message}`);
      }
      
      return res.status(400).json({
        success: false,
        message: `文件类型不正确。${conversionType}转换需要${allowedExtensions.join('或')}格式的文件，但收到的是${fileExtension}格式`
      });
    }
    
    const uniqueId = uuidv4();
    
    // 根据转换类型确定输出文件扩展名
    let outputExtension;
    switch (conversionType) {
      case 'pdf-to-word':
        outputExtension = '.docx';
        break;
      case 'pdf-to-excel':
        outputExtension = '.xlsx';
        break;
      case 'pdf-to-ppt':
        outputExtension = '.pptx';
        break;
      case 'word-to-pdf':
      case 'excel-to-pdf':
      case 'ppt-to-pdf':
        outputExtension = '.pdf';
        break;
      default:
        outputExtension = '.pdf'; // 默认
    }
    
    const outputFilePath = path.join(outputDir, uniqueId + outputExtension);
    console.log('输出文件路径:', outputFilePath);

    try {
      console.log('开始转换文件...');
      await convertFile(uploadedFilePath, outputFilePath, conversionType);
      console.log('文件转换成功');
    } catch (conversionError) {
      console.error('文件转换失败:', conversionError);
      
      // 检查输入文件是否存在
      if (!fs.existsSync(uploadedFilePath)) {
        return res.status(500).json({ 
          success: false, 
          message: '上传的文件无法找到，转换失败',
          error: '文件不存在'
        });
      }
      
      // 返回详细错误信息
      return res.status(500).json({ 
        success: false, 
        message: conversionError.message || '文件转换失败，请检查文件格式是否正确', 
        error: conversionError.message 
      });
    }

    // 检查输出文件是否存在
    if (!fs.existsSync(outputFilePath)) {
      console.error('转换后的文件不存在:', outputFilePath);
      return res.status(500).json({ 
        success: false, 
        message: '转换文件不存在，转换可能失败', 
        error: '输出文件不存在'
      });
    }

    // 检查输出文件大小
    const outputSize = fs.statSync(outputFilePath).size;
    if (outputSize === 0) {
      console.error('转换后的文件为空');
      fs.unlinkSync(outputFilePath); // 删除空文件
      return res.status(500).json({
        success: false,
        message: '转换失败，生成的文件为空',
        error: '输出文件为空'
      });
    }

    // 生成下载链接
    const downloadLink = `/api/download?file=${path.basename(outputFilePath)}`;
    console.log('生成下载链接:', downloadLink);

    // 返回成功结果
    console.log('返回成功响应');
    res.json({
      success: true,
      file: {
        originalName: req.file.originalname,
        convertedName: path.basename(outputFilePath),
        downloadLink: downloadLink,
        size: outputSize
      }
    });
  } catch (error) {
    console.error('转换过程中出错:', error);
    res.status(500).json({ 
      success: false, 
      message: '文件处理过程中发生错误', 
      error: error.message 
    });
  }
});

// 处理文件下载请求
app.get('/api/download', (req, res) => {
  const fileName = req.query.file;
  if (!fileName) {
    return res.status(400).send('文件名不能为空');
  }

  // 安全检查，防止目录遍历攻击
  const sanitizedFileName = path.basename(fileName);
  const filePath = path.join(outputDir, sanitizedFileName);

  // 检查文件是否存在
  if (!fs.existsSync(filePath)) {
    return res.status(404).send('文件不存在');
  }

  // 获取原始文件名（假设文件名格式为: uuid.ext）
  const fileExtension = path.extname(sanitizedFileName);
  let suggestedFileName;

  // 根据扩展名生成友好的文件名
  switch (fileExtension.toLowerCase()) {
    case '.docx':
      suggestedFileName = '转换后的文档.docx';
      break;
    case '.xlsx':
      suggestedFileName = '转换后的表格.xlsx';
      break;
    case '.pptx':
      suggestedFileName = '转换后的演示文稿.pptx';
      break;
    case '.pdf':
      suggestedFileName = '转换后的文档.pdf';
      break;
    default:
      suggestedFileName = sanitizedFileName;
  }

  // 设置下载头
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(suggestedFileName)}"`);
  res.setHeader('Content-Type', getMimeType(fileExtension));

  // 发送文件
  const fileStream = fs.createReadStream(filePath);
  fileStream.pipe(res);
});

// PDF拆分API端点
app.post('/api/split-pdf', upload.single('file'), async (req, res) => {
  try {
    console.log('收到PDF拆分请求');
    
    if (!req.file) {
      console.log('没有收到文件');
      return res.status(400).json({ success: false, message: '没有上传文件' });
    }

    console.log('文件上传成功:', req.file.originalname);
    console.log('文件保存路径:', req.file.path);
    console.log('文件大小:', req.file.size, '字节');
    console.log('文件类型:', req.file.mimetype);
    
    // 检查文件类型
    const fileExtension = path.extname(req.file.originalname).toLowerCase();
    if (fileExtension !== '.pdf') {
      console.error('上传的不是PDF文件:', fileExtension);
      
      // 删除上传的文件
      try {
        fs.unlinkSync(req.file.path);
        console.log('已删除非PDF文件');
      } catch (e) {
        console.warn(`无法删除不匹配的文件: ${e.message}`);
      }
      
      return res.status(400).json({
        success: false,
        message: '请上传PDF格式的文件'
      });
    }
    
    // 获取要提取的页码
    const { pages } = req.body;
    if (!pages) {
      console.log('未指定要提取的页码');
      return res.status(400).json({ success: false, message: '未指定要提取的页码' });
    }
    
    console.log('请求提取的页码:', pages);
    
    // 创建输出文件夹
    const tempDir = path.join(__dirname, 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
      console.log('创建临时目录:', tempDir);
    }
    
    // 生成唯一文件名
    const uniqueId = uuidv4();
    const outputFilePath = path.join(outputDir, uniqueId + '.pdf');
    console.log('将生成的输出文件路径:', outputFilePath);
    
    // 进行PDF拆分
    try {
      console.log('开始拆分PDF...');
      await splitPdf(req.file.path, outputFilePath, pages);
      console.log('PDF拆分成功');
    } catch (error) {
      console.error('PDF拆分失败:', error);
      return res.status(500).json({ 
        success: false, 
        message: error.message || 'PDF拆分失败，请检查页码格式是否正确', 
        error: error.message 
      });
    }
    
    // 检查输出文件是否存在
    if (!fs.existsSync(outputFilePath)) {
      console.error('拆分后的文件不存在:', outputFilePath);
      return res.status(500).json({ 
        success: false, 
        message: '拆分后的文件不存在', 
        error: '输出文件不存在'
      });
    }
    
    // 检查输出文件大小
    const outputSize = fs.statSync(outputFilePath).size;
    console.log('拆分后的文件大小:', outputSize, '字节');
    
    if (outputSize === 0) {
      console.error('拆分后的文件为空');
      fs.unlinkSync(outputFilePath); // 删除空文件
      console.log('已删除空文件');
      
      return res.status(500).json({
        success: false,
        message: '拆分失败，生成的文件为空',
        error: '输出文件为空'
      });
    }
    
    // 生成下载链接
    const downloadLink = `/api/download?file=${path.basename(outputFilePath)}`;
    console.log('生成下载链接:', downloadLink);
    
    // 返回成功结果
    console.log('拆分PDF成功，返回结果');
    res.status(200).json({
      success: true,
      file: {
        originalName: req.file.originalname,
        convertedName: path.basename(outputFilePath),
        downloadLink: downloadLink,
        size: outputSize
      }
    });
  } catch (error) {
    console.error('拆分过程中出错:', error);
    res.status(500).json({ 
      success: false, 
      message: 'PDF拆分过程中发生错误', 
      error: error.message 
    });
  }
});

// PDF合并API端点
app.post('/api/merge-pdf', upload.array('files', 10), async (req, res) => {
  try {
    console.log('收到PDF合并请求');
    
    if (!req.files || req.files.length === 0) {
      console.log('没有收到文件');
      return res.status(400).json({ success: false, message: '没有上传文件' });
    }

    console.log('上传文件数量:', req.files.length);
    
    // 检查文件类型
    const invalidFiles = req.files.filter(file => path.extname(file.originalname).toLowerCase() !== '.pdf');
    if (invalidFiles.length > 0) {
      console.error('有非PDF文件上传');
      
      // 删除所有上传的文件
      req.files.forEach(file => {
        try {
          fs.unlinkSync(file.path);
        } catch (e) {
          console.warn(`无法删除文件: ${e.message}`);
        }
      });
      
      return res.status(400).json({
        success: false,
        message: '所有文件必须是PDF格式'
      });
    }
    
    // 生成唯一文件名
    const uniqueId = uuidv4();
    const outputFilePath = path.join(outputDir, uniqueId + '.pdf');
    
    // 合并PDF文件
    try {
      const filePaths = req.files.map(file => file.path);
      await mergePdf(filePaths, outputFilePath);
      console.log('PDF合并成功');
    } catch (error) {
      console.error('PDF合并失败:', error);
      return res.status(500).json({ 
        success: false, 
        message: error.message || 'PDF合并失败', 
        error: error.message 
      });
    }
    
    // 检查输出文件
    if (!fs.existsSync(outputFilePath) || fs.statSync(outputFilePath).size === 0) {
      console.error('合并后的文件不存在或为空');
      return res.status(500).json({ 
        success: false, 
        message: '合并失败，输出文件无效', 
      });
    }
    
    // 生成下载链接
    const downloadLink = `/api/download?file=${path.basename(outputFilePath)}`;
    
    // 返回成功结果
    res.json({
      success: true,
      file: {
        originalName: '合并文档.pdf',
        convertedName: path.basename(outputFilePath),
        downloadLink: downloadLink,
        size: fs.statSync(outputFilePath).size
      }
    });
  } catch (error) {
    console.error('合并过程中出错:', error);
    res.status(500).json({ 
      success: false, 
      message: 'PDF合并过程中发生错误', 
      error: error.message 
    });
  }
});

// PDF压缩API端点
app.post('/api/compress-pdf', upload.single('file'), async (req, res) => {
  try {
    console.log('收到PDF压缩请求');
    
    if (!req.file) {
      console.log('没有收到文件');
      return res.status(400).json({ success: false, message: '没有上传文件' });
    }

    console.log('文件上传成功:', req.file.originalname);
    
    // 检查文件类型
    const fileExtension = path.extname(req.file.originalname).toLowerCase();
    if (fileExtension !== '.pdf') {
      console.error('上传的不是PDF文件');
      
      // 删除上传的文件
      try {
        fs.unlinkSync(req.file.path);
      } catch (e) {
        console.warn(`无法删除不匹配的文件: ${e.message}`);
      }
      
      return res.status(400).json({
        success: false,
        message: '请上传PDF格式的文件'
      });
    }
    
    // 获取压缩级别
    const compressionLevel = req.body.compressionLevel || 'medium';
    console.log('压缩级别:', compressionLevel);
    
    // 生成唯一文件名
    const uniqueId = uuidv4();
    const outputFilePath = path.join(outputDir, uniqueId + '.pdf');
    
    // 压缩PDF
    try {
      await compressPdf(req.file.path, outputFilePath, compressionLevel);
      console.log('PDF压缩成功');
    } catch (error) {
      console.error('PDF压缩失败:', error);
      return res.status(500).json({ 
        success: false, 
        message: error.message || 'PDF压缩失败', 
        error: error.message 
      });
    }
    
    // 检查输出文件
    if (!fs.existsSync(outputFilePath)) {
      console.error('压缩后的文件不存在');
      return res.status(500).json({ 
        success: false, 
        message: '压缩失败，输出文件不存在', 
      });
    }
    
    const originalSize = fs.statSync(req.file.path).size;
    const compressedSize = fs.statSync(outputFilePath).size;
    const savedPercentage = ((originalSize - compressedSize) / originalSize * 100).toFixed(2);
    
    // 生成下载链接
    const downloadLink = `/api/download?file=${path.basename(outputFilePath)}`;
    
    // 返回成功结果
    res.json({
      success: true,
      file: {
        originalName: req.file.originalname,
        convertedName: path.basename(outputFilePath),
        downloadLink: downloadLink,
        originalSize: originalSize,
        compressedSize: compressedSize,
        savedPercentage: savedPercentage
      }
    });
  } catch (error) {
    console.error('压缩过程中出错:', error);
    res.status(500).json({ 
      success: false, 
      message: 'PDF压缩过程中发生错误', 
      error: error.message 
    });
  }
});

// 使用Cloudmersive API进行文件转换
async function convertWithCloudmersive(inputFile, outputFile, conversionType) {
  return new Promise(async (resolve, reject) => {
    try {
      console.log(`使用Cloudmersive API转换，类型: ${conversionType}`);
      
      // 读取输入文件
      const inputData = fs.readFileSync(inputFile);
      
      // 创建API实例
      const convertApi = new CloudmersiveConvertApiClient.ConvertDocumentApi();
      
      // 设置API客户端超时
      const apiClient = convertApi.apiClient;
      apiClient.timeout = 60000; // 60秒超时
      
      let apiFunction;
      let requestData = inputData;
      
      // 根据转换类型选择相应的API函数
      switch (conversionType) {
        case 'word-to-pdf':
          apiFunction = convertApi.convertDocumentDocxToPdf.bind(convertApi);
          break;
        case 'excel-to-pdf':
          apiFunction = convertApi.convertDocumentXlsxToPdf.bind(convertApi);
          break;
        case 'ppt-to-pdf':
          apiFunction = convertApi.convertDocumentPptxToPdf.bind(convertApi);
          break;
        default:
          return reject(new Error('不支持的转换类型'));
      }
      
      // 设置超时
      const timeoutId = setTimeout(() => {
        reject(new Error('API请求超时，请稍后再试或减小文件大小'));
      }, 55000); // 55秒超时
      
      // 调用API进行转换
      apiFunction(Buffer.from(requestData), (error, data, response) => {
        clearTimeout(timeoutId); // 清除超时
        
        if (error) {
          console.error('转换API调用失败:', error);
          return reject(new Error(`API调用失败: ${error.message}`));
        }
        
        // 将返回的数据写入输出文件
        fs.writeFileSync(outputFile, data);
        console.log(`Cloudmersive API转换成功，文件保存到: ${outputFile}`);
        resolve(outputFile);
      });
    } catch (error) {
      console.error('Cloudmersive转换错误:', error);
      reject(new Error(`Cloudmersive转换失败: ${error.message}`));
    }
  });
}

// 使用LibreOffice进行其他格式的转换
async function convertWithLibreOffice(inputFile, outputFile, conversionType) {
  return new Promise((resolve, reject) => {
    try {
      // 在Vercel环境中，直接返回错误
      if (process.env.VERCEL) {
        return reject(new Error('在Vercel环境中不支持LibreOffice转换，请在本地环境中使用此功能'));
      }

      // 创建临时工作目录
      const tempDir = path.join(__dirname, 'temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      // 使用简单的文件名
      const timestamp = Date.now();
      const uniqueName = `file_${timestamp}`;
      const fileExtension = path.extname(inputFile).toLowerCase();
      const tempInputFile = path.join(tempDir, uniqueName + fileExtension);

      console.log(`准备使用LibreOffice转换: ${fileExtension} -> ${conversionType}`);

      // 复制输入文件到临时目录
      fs.copyFileSync(inputFile, tempInputFile);

      // 设置输出格式
      let format;
      switch (conversionType) {
        case 'word-to-pdf':
          format = 'pdf';
          break;
        case 'excel-to-pdf':
          format = 'pdf';
          break;
        case 'ppt-to-pdf':
          format = 'pdf';
          break;
        default:
          fs.unlinkSync(tempInputFile);
          return reject(new Error('不支持的转换类型'));
      }

      // 检查LibreOffice路径
      const libreOffice = '/Applications/LibreOffice.app/Contents/MacOS/soffice';
      if (!fs.existsSync(libreOffice)) {
        return reject(new Error('LibreOffice未找到，请确保已正确安装'));
      }

      // 执行转换
      const args = [
        '--headless',
        '--norestore',
        '--convert-to', format,
        '--outdir', tempDir,
        tempInputFile
      ];

      console.log(`执行LibreOffice转换: ${libreOffice} ${args.join(' ')}`);

      const process = spawn(libreOffice, args);
      let stdoutData = '';
      let stderrData = '';

      process.stdout.on('data', (data) => {
        stdoutData += data.toString();
      });

      process.stderr.on('data', (data) => {
        stderrData += data.toString();
      });

      process.on('close', (code) => {
        if (code !== 0) {
          fs.unlinkSync(tempInputFile);
          return reject(new Error(`LibreOffice转换失败: ${stderrData}`));
        }

        // 查找输出文件
        const expectedOutputFile = path.join(tempDir, `${uniqueName}.${format}`);
        const tempFiles = fs.readdirSync(tempDir);
        
        let foundOutput = false;
        for (const file of tempFiles) {
          if (file.startsWith(uniqueName) && file.endsWith(`.${format}`)) {
            const tempOutputFile = path.join(tempDir, file);
            fs.copyFileSync(tempOutputFile, outputFile);
            fs.unlinkSync(tempInputFile);
            fs.unlinkSync(tempOutputFile);
            foundOutput = true;
            break;
          }
        }

        if (foundOutput) {
          resolve(outputFile);
        } else {
          reject(new Error('LibreOffice转换失败，未找到输出文件'));
        }
      });
    } catch (error) {
      reject(new Error(`LibreOffice转换异常: ${error.message}`));
    }
  });
}

// 获取文件的MIME类型
function getMimeType(extension) {
  const mimeTypes = {
    '.pdf': 'application/pdf',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xls': 'application/vnd.ms-excel',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.ppt': 'application/vnd.ms-powerpoint',
    '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  };
  
  return mimeTypes[extension.toLowerCase()] || 'application/octet-stream';
}

// PDF拆分功能
async function splitPdf(inputPath, outputPath, pageRangeStr) {
  try {
    console.log('开始解析页码范围:', pageRangeStr);
    // 解析页码范围，例如 "1,3-5,7" 转换为 [1, 3, 4, 5, 7]
    const pageRanges = pageRangeStr.split(',');
    const pageNumbers = [];
    
    for (const range of pageRanges) {
      if (range.includes('-')) {
        // 处理范围，例如 "3-5"
        const [start, end] = range.split('-').map(num => parseInt(num.trim(), 10));
        if (isNaN(start) || isNaN(end)) {
          throw new Error('页码范围格式无效');
        }
        if (start > end) {
          throw new Error('页码范围的起始页不能大于结束页');
        }
        for (let i = start; i <= end; i++) {
          pageNumbers.push(i);
        }
      } else {
        // 处理单页，例如 "1"
        const page = parseInt(range.trim(), 10);
        if (isNaN(page)) {
          throw new Error('页码格式无效');
        }
        pageNumbers.push(page);
      }
    }
    
    console.log('解析后的页码列表:', pageNumbers);
    
    // 读取输入PDF
    console.log('读取输入PDF文件:', inputPath);
    const pdfBytes = fs.readFileSync(inputPath);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const totalPages = pdfDoc.getPageCount();
    console.log('PDF总页数:', totalPages);
    
    // 验证页码是否有效
    const invalidPages = pageNumbers.filter(page => page <= 0 || page > totalPages);
    if (invalidPages.length > 0) {
      throw new Error(`无效的页码: ${invalidPages.join(', ')}. 文档总页数为 ${totalPages}`);
    }
    
    // 创建新的PDF文档
    console.log('创建新的PDF文档...');
    const outputPdf = await PDFDocument.create();
    
    // 复制所选页面到新文档
    console.log('开始复制选中的页面...');
    for (const pageNumber of pageNumbers) {
      // 页码从1开始，而PDFDocument中的页码从0开始
      const [copiedPage] = await outputPdf.copyPages(pdfDoc, [pageNumber - 1]);
      outputPdf.addPage(copiedPage);
      console.log(`已复制第 ${pageNumber} 页`);
    }
    
    // 保存新文档
    console.log('保存拆分后的PDF文档到:', outputPath);
    const outputBytes = await outputPdf.save();
    fs.writeFileSync(outputPath, outputBytes);
    
    console.log(`已拆分PDF，提取了${pageNumbers.length}页：${pageNumbers.join(', ')}`);
    return outputPath;
  } catch (error) {
    console.error('PDF拆分失败:', error);
    throw new Error(`PDF拆分失败: ${error.message}`);
  }
}

// PDF合并功能
async function mergePdf(inputPaths, outputPath) {
  try {
    // 创建新的PDF文档
    const mergedPdf = await PDFDocument.create();
    
    // 依次处理每个输入的PDF文件
    for (const inputPath of inputPaths) {
      // 读取PDF文件
      const pdfBytes = fs.readFileSync(inputPath);
      const pdfDoc = await PDFDocument.load(pdfBytes);
      
      // 复制所有页面到新文档
      const copiedPages = await mergedPdf.copyPages(pdfDoc, pdfDoc.getPageIndices());
      copiedPages.forEach(page => mergedPdf.addPage(page));
    }
    
    // 保存合并后的文档
    const mergedBytes = await mergedPdf.save();
    fs.writeFileSync(outputPath, mergedBytes);
    
    console.log(`成功合并 ${inputPaths.length} 个PDF文件到 ${outputPath}`);
    return outputPath;
  } catch (error) {
    console.error('PDF合并失败:', error);
    throw new Error(`PDF合并失败: ${error.message}`);
  }
}

// PDF压缩功能
async function compressPdf(inputPath, outputPath, compressionLevel = 'medium') {
  try {
    // 读取输入PDF
    const pdfBytes = fs.readFileSync(inputPath);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    
    // 压缩选项
    const compressionOptions = {
      low: { quality: 0.8 },
      medium: { quality: 0.6 },
      high: { quality: 0.4 }
    };
    
    const option = compressionOptions[compressionLevel] || compressionOptions.medium;
    
    // 创建新的PDF文档
    const compressedPdf = await PDFDocument.create();
    
    // 复制所有页面到新文档，应用压缩
    for (let i = 0; i < pdfDoc.getPageCount(); i++) {
      const [page] = await compressedPdf.copyPages(pdfDoc, [i]);
      
      // 这里我们不对图像进行实际压缩，因为PDFLib暂不直接支持
      // 在实际项目中，可以用如ImageMagick等工具处理嵌入的图像
      compressedPdf.addPage(page);
    }
    
    // 保存压缩后的文档
    const compressedBytes = await compressedPdf.save({
      useObjectStreams: true,  // 使用对象流减小文件大小
      addCompression: true     // 启用压缩
    });
    
    fs.writeFileSync(outputPath, compressedBytes);
    
    console.log(`成功压缩PDF文件，压缩级别: ${compressionLevel}`);
    return outputPath;
  } catch (error) {
    console.error('PDF压缩失败:', error);
    throw new Error(`PDF压缩失败: ${error.message}`);
  }
}

// 执行文件转换的函数
function convertFile(inputFile, outputFile, conversionType) {
  return new Promise(async (resolve, reject) => {
    try {
      // 检查输入文件是否存在
      if (!fs.existsSync(inputFile)) {
        console.error(`输入文件不存在: ${inputFile}`);
        return reject(new Error(`输入文件不存在: ${inputFile}`));
      }

      // 确保输出目录存在
      const outputDir = path.dirname(outputFile);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
        console.log(`创建输出目录: ${outputDir}`);
      }

      // 选择转换方法
      switch (conversionType) {
        case 'pdf-to-word':
          await convertPdfToWord(inputFile, outputFile);
          break;
        case 'pdf-to-excel':
          await convertPdfToExcel(inputFile, outputFile);
          break;
        case 'pdf-to-ppt':
          await convertPdfToPpt(inputFile, outputFile);
          break;
        case 'word-to-pdf':
        case 'excel-to-pdf':
        case 'ppt-to-pdf':
          // 在Vercel环境中使用Cloudmersive API，否则使用LibreOffice
          if (process.env.VERCEL) {
            await convertWithCloudmersive(inputFile, outputFile, conversionType);
          } else {
            await convertWithLibreOffice(inputFile, outputFile, conversionType);
          }
          break;
        default:
          return reject(new Error('不支持的转换类型'));
      }

      // 检查输出文件是否生成
      if (!fs.existsSync(outputFile)) {
        return reject(new Error('转换失败，未能生成输出文件'));
      }

      console.log(`文件成功转换为: ${outputFile}`);
      resolve(outputFile);
    } catch (error) {
      console.error(`转换过程中发生异常: ${error.message}`);
      reject(new Error(`文件转换失败: ${error.message}`));
    }
  });
}

// 添加一个诊断路由，检查配置
app.get('/api/diagnostics', (req, res) => {
  const diagnostics = {
    environment: process.env.VERCEL ? 'Vercel' : 'Local',
    node_version: process.version,
    api_key_configured: !!process.env.CLOUDMERSIVE_API_KEY,
    memory_limit: process.env.VERCEL_REGION || 'unknown',
    temp_directory: {
      exists: fs.existsSync('/tmp'),
      writable: true // 假设可写
    }
  };
  
  // 尝试写入临时文件测试权限
  try {
    const testFile = '/tmp/test-write-' + Date.now() + '.txt';
    fs.writeFileSync(testFile, 'test');
    fs.unlinkSync(testFile);
    diagnostics.temp_directory.writable = true;
  } catch (error) {
    diagnostics.temp_directory.writable = false;
    diagnostics.temp_directory.error = error.message;
  }
  
  res.json(diagnostics);
});

// 添加全局错误处理中间件
app.use((err, req, res, next) => {
  console.error('服务器错误:', err);
  
  // 处理Cloudmersive API相关错误
  if (err.message && err.message.includes('API')) {
    return res.status(500).json({
      success: false,
      message: '文档转换API服务出错，请稍后再试',
      error: err.message,
      isApiError: true
    });
  }
  
  res.status(500).json({
    success: false,
    message: '服务器内部错误',
    error: err.message
  });
});

// 修改文件上传错误处理
app.use((req, res, next) => {
  try {
    next();
  } catch (error) {
    console.error('请求处理错误:', error);
    res.status(500).json({
      success: false,
      message: '请求处理失败',
      error: error.message
    });
  }
});

// 启动服务器
app.listen(port, '0.0.0.0', () => {
  console.log(`PDF转换服务器运行在 http://localhost:${port}`);
}); 