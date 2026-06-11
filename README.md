# daily-task

一个基于 FastAPI 的模型效果评测 Web 应用，支持文本生成、图片生成与预留的视频生成入口。

## 包含内容

- `web/`: Web 服务与静态页面
- `src/`: Provider 与通用能力
- `config/`: 模型与任务配置
- `tools/`: 生成与评测脚本
- `requirements.txt`: Python 依赖
- `.env.example`: 环境变量示例

## 本地启动

1. 安装依赖

```bash
pip install -r requirements.txt
```

2. 配置环境变量

```bash
cp .env.example .env
```

按实际平台填写 API Key 与 Base URL。

3. 启动服务

```bash
python -m web.app
```

默认访问地址：

```text
http://127.0.0.1:8080/
```

## 部署说明

这是完整应用，不是纯静态页面。前端页面依赖 FastAPI 的 `/api/*` 接口，因此如果希望他人直接访问，需要将本仓库部署到可运行 Python Web 服务的服务器上。

推荐部署方式：

- 云服务器 + `uvicorn`
- `nginx` 反向代理到 `8080`
- 容器化部署到支持 Python 的平台

## 注意事项

- 不要提交 `.env`
- 不要提交 `outputs/` 等运行产物
- `config/benchmark_models.yaml` 决定可选模型
- `config/tasks.yaml` 决定任务下拉内容
