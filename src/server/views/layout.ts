export function layout(title: string, content: string): string {
  return `<!DOCTYPE html>
<html lang="en" data-theme="light">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} — Sauron</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@picocss/pico@2/css/pico.min.css">
  <link rel="stylesheet" href="/public/styles.css">
</head>
<body>
  <nav class="container-fluid">
    <ul><li><a href="/"><strong>Sauron</strong></a></li></ul>
    <ul>
      <li><button id="run-btn" class="outline" onclick="triggerRun()">Run Now</button></li>
    </ul>
  </nav>
  <main class="container">
    ${content}
  </main>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4"></script>
  <script src="/public/charts.js"></script>
</body>
</html>`;
}
