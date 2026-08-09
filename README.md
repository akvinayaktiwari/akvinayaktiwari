# 💫 About Me:
🎓 Graduate of NIT Raipur'24. <br>
🚀 Building AI infrastructure and developer tools that simplify how businesses adopt AI.<br><br>

🔭 Building AI-first SaaS products<br>
🤖 Developing AI Agents, MCP Servers & Intelligent Automation Platforms<br>
☁️ Building scalable cloud-native applications on AWS with serverless architectures<br>
🧠 Passionate about Agentic AI, RAG, Voice AI, AI Infrastructure & Developer Experience<br>
💬 Ask me about AI, LLMs, MCP, AWS, Node.js, Next.js, TypeScript and System Design<br>
🌱 Currently exploring distributed AI systems, real-time AI, and autonomous workflows<br>
⚡ I enjoy turning ambitious product ideas into production-ready software.

---

## 🌐 Socials:

[![LinkedIn](https://img.shields.io/badge/LinkedIn-%230077B5.svg?logo=linkedin&logoColor=white)](https://www.linkedin.com/in/vinayak-t-54899a123/)
[![X](https://img.shields.io/badge/X-black.svg?logo=x&logoColor=white)](https://x.com/akvinayaktiwari)
[![GitHub](https://img.shields.io/badge/GitHub-181717.svg?logo=github&logoColor=white)](https://github.com/akvinayaktiwari)

---

# 💻 Tech Stack:

### Languages

![TypeScript](https://img.shields.io/badge/TypeScript-%23007ACC.svg?style=for-the-badge&logo=typescript&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E.svg?style=for-the-badge&logo=javascript&logoColor=black)
![Python](https://img.shields.io/badge/Python-3776AB.svg?style=for-the-badge&logo=python&logoColor=white)
![C#](https://img.shields.io/badge/C%23-%23239120.svg?style=for-the-badge&logo=csharp&logoColor=white)
![Solidity](https://img.shields.io/badge/Solidity-%23363636.svg?style=for-the-badge&logo=solidity&logoColor=white)

### Frontend

![React](https://img.shields.io/badge/React-%2320232a.svg?style=for-the-badge&logo=react&logoColor=%2361DAFB)
![Next JS](https://img.shields.io/badge/Next-black?style=for-the-badge&logo=next.js&logoColor=white)
![Remix](https://img.shields.io/badge/Remix-%23000.svg?style=for-the-badge&logo=remix&logoColor=white)

### Backend

![NodeJS](https://img.shields.io/badge/Node.js-6DA55F?style=for-the-badge&logo=node.js&logoColor=white)
![Express.js](https://img.shields.io/badge/Express.js-%23404d59.svg?style=for-the-badge&logo=express&logoColor=%2361DAFB)
![NestJS](https://img.shields.io/badge/NestJS-%23E0234E.svg?style=for-the-badge&logo=nestjs&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-005571?style=for-the-badge&logo=fastapi)
![.NET](https://img.shields.io/badge/.NET-5C2D91.svg?style=for-the-badge&logo=.net&logoColor=white)

### AWS

![AWS](https://img.shields.io/badge/AWS-%23FF9900.svg?style=for-the-badge&logo=amazon-aws&logoColor=white)
![Lambda](https://img.shields.io/badge/Lambda-FF9900.svg?style=for-the-badge&logoColor=white)
![DynamoDB](https://img.shields.io/badge/DynamoDB-4053D6.svg?style=for-the-badge&logoColor=white)
![SQS](https://img.shields.io/badge/SQS-FF4F8B.svg?style=for-the-badge&logoColor=white)
![Step Functions](https://img.shields.io/badge/Step_Functions-CD2264.svg?style=for-the-badge&logoColor=white)
![EventBridge](https://img.shields.io/badge/EventBridge-E7157B.svg?style=for-the-badge&logoColor=white)
![S3](https://img.shields.io/badge/S3-569A31.svg?style=for-the-badge&logoColor=white)
![CloudFront](https://img.shields.io/badge/CloudFront-8C4FFF.svg?style=for-the-badge&logoColor=white)
![Cognito](https://img.shields.io/badge/Cognito-DD344C.svg?style=for-the-badge&logoColor=white)
![SES](https://img.shields.io/badge/SES-232F3E.svg?style=for-the-badge&logoColor=white)
![KMS](https://img.shields.io/badge/KMS-DD344C.svg?style=for-the-badge&logoColor=white)

### DevOps & Tooling

![Docker](https://img.shields.io/badge/Docker-2496ED.svg?style=for-the-badge&logo=docker&logoColor=white)
![GitHub Actions](https://img.shields.io/badge/GitHub%20Actions-%232671E5.svg?style=for-the-badge&logo=githubactions&logoColor=white)
![Jenkins](https://img.shields.io/badge/Jenkins-%232C5263.svg?style=for-the-badge&logo=jenkins&logoColor=white)
![Bun](https://img.shields.io/badge/Bun-%23000000.svg?style=for-the-badge&logo=bun&logoColor=white)

### AI & Infrastructure

![OpenAI](https://img.shields.io/badge/OpenAI-412991?style=for-the-badge&logo=openai&logoColor=white)
![Claude](https://img.shields.io/badge/Claude-D97757?style=for-the-badge)
![Pinecone](https://img.shields.io/badge/Pinecone-0055FF?style=for-the-badge)
![LangChain](https://img.shields.io/badge/LangChain-1C3C3C?style=for-the-badge)
![MCP](https://img.shields.io/badge/Model_Context_Protocol-black?style=for-the-badge)

---

# 🚀 Currently Building

- 🤖 An AI CRM where agents work leads instead of forms collecting them
- 🔌 MCP servers that give those agents real tools — booking, reminders, quotes
- 🎙️ Real-time voice AI agents with their own retrieval layer
- 💬 Multi-channel support across web chat, WhatsApp, and inbound ads
- ⚙️ Queue-backed ingestion — crawling, parsing, and embedding at scale
- ☁️ Serverless AI infrastructure on AWS, event-driven end to end

---

# ⚙️ How I Build: Async by Default

The request path stays fast. Everything slow moves to a queue or a state machine.

- **Queue-backed ingestion (SQS)** — website crawls, PDF/DOCX parsing, and embedding jobs go out as typed job messages and get drained by a worker Lambda, so a 200-page crawl never blocks an API response
- **Idempotent job claiming** — conditional writes let a worker claim a job exactly once, so an SQS redelivery re-runs nothing it already finished
- **Step Functions for long-running agent journeys** — multi-day, multi-step workflows that park on a callback token while waiting for a human to reply, instead of holding a Lambda open for hours
- **EventBridge Scheduler** — follow-ups, reminders, and re-checks scheduled per lead, rather than a cron sweep polling the whole table
- **DynamoDB designed around access patterns** — partition keys chosen from the queries that actually run, GSIs only where one earns its keep
- **Atomic claim tables** — single-writer guarantees for anything that must happen exactly once, so no lead ever gets contacted twice
- **KMS-encrypted credentials, S3 presigned uploads, SES transactional email, Cognito JWT on every protected route**
- **Serverless-first** — no idle servers, cost tracks real traffic

---

# 📊 GitHub Stats:

![](https://github-readme-stats.shion.dev/api?username=akvinayaktiwari&theme=dark&hide_border=false&include_all_commits=true&count_private=true)

![](https://streak-stats.demolab.com/?user=akvinayaktiwari&theme=dark&hide_border=false)

![](https://github-readme-stats.shion.dev/api/top-langs/?username=akvinayaktiwari&theme=dark&hide_border=false&include_all_commits=true&count_private=true&layout=compact)

---

## 🐍 Watch My Contributions Get Eaten

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akvinayaktiwari/akvinayaktiwari/output/github-snake-dark.svg" />
  <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/akvinayaktiwari/akvinayaktiwari/output/github-snake.svg" />
  <img alt="snake eating my contribution graph" src="https://raw.githubusercontent.com/akvinayaktiwari/akvinayaktiwari/output/github-snake.svg" />
</picture>

---

## 🏆 GitHub Trophies

![](https://github-profile-trophy.vercel.app/?username=akvinayaktiwari&theme=tokyonight&no-frame=false&margin-w=8)

---

## 📈 Profile Views

![](https://komarev.com/ghpvc/?username=akvinayaktiwari&style=for-the-badge)

---

> *"Building products where AI feels less like a feature and more like a teammate."*
