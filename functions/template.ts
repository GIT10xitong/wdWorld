export function getTemplate({
  redirectPath,
  withError
}: {
  redirectPath: string;
  withError: boolean;
}): string {
  return `
  <!doctype html>
  <html lang="zh-CN" data-theme="dark">

    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>私人博客 - 请先登录</title>
      <meta name="description" content="This site is password protected.">
      <link rel="shortcut icon" href="/favicon.ico">

      <link rel="stylesheet" href="https://unpkg.com/@picocss/pico@latest/css/pico.min.css">

      <style>
        body > main {
          display: flex;
          flex-direction: column;
          justify-content: center;
          min-height: calc(100vh - 7rem);
          padding: 1rem 0;
          max-width: 600px;
          margin: 0 auto;
        }

        .error {
          background: #7FFFD4;
          border-radius: 20px;
          color: #d32f2f;
          padding: 0.5em 1em;
          font-weight: bold;
        }

        h1 { color: #00BCD4; /* 亮青色 */ }
        h2 { color: #009688; }
        /* 输入框和按钮的自定义 */
        input[type="password"] {
          border-color: #009688; /* 输入框边框变成青绿色 */
        }
        
        /* 当鼠标点击输入框时，边框发光变青色 */
        input[type="password"]:focus {
          border-color: #00BCD4;
          box-shadow: 0 0 0 3px rgba(0, 188, 212, 0.3);
        }

        /* 登录按钮的颜色 */
        button[type="submit"] {
          background-color: #009688 !important; /* 青绿色按钮 */
          border-color: #009688 !important;
          color: white !important; /* 按钮文字改成白色 */
          transition: all 0.3s ease; /* 添加平滑过渡动画 */
        }

        /* 鼠标悬停在按钮上时，变成亮青色 */
        button[type="submit"]:hover {
          background-color: #00BCD4 !important;
          border-color: #00BCD4 !important;
        }
      </style>
    </head>

    <body>
      <main>
        <article>
          <hgroup>
            <h1>OC世界观创造</h1>
            <h2>验证它的创造者</h2>
          </hgroup>
          ${withError ? `<p class="密码错误，请重试！</p>` : ''}
          <form method="post" action="/cfp_login">
            <input type="hidden" name="redirect" value="${redirectPath}" />
            <input type="password" name="password" placeholder="请输入密码" aria-label="Password" autocomplete="current-password" required autofocus>
            <button type="submit" class="contrast">进入</button>
          </form>
        </article>
      </main>
    </body>

  </html>
  `;
}
