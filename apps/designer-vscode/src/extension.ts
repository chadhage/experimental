import * as vscode from 'vscode';

const API_BASE = process.env.QD_API_URL ?? 'http://localhost:8080';
const TOKEN = process.env.QD_TOKEN ?? 'dev-token';

export function activate(context: vscode.ExtensionContext) {
  // Embeds the web designer in a VS Code webview (third designer surface from the brief).
  context.subscriptions.push(
    vscode.commands.registerCommand('queryDesigner.openDesigner', () => {
      const panel = vscode.window.createWebviewPanel(
        'queryDesigner',
        'Query Designer',
        vscode.ViewColumn.One,
        { enableScripts: true }
      );
      const designerUrl = process.env.QD_DESIGNER_URL ?? 'http://localhost:5173';
      panel.webview.html = `<!doctype html><html><body style="margin:0">
        <iframe src="${designerUrl}" style="border:0;width:100vw;height:100vh"></iframe>
      </body></html>`;
    })
  );

  // Publish the SQL in the active editor straight to an endpoint.
  context.subscriptions.push(
    vscode.commands.registerCommand('queryDesigner.publish', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage('Open a .sql file to publish.');
        return;
      }
      const sql = editor.document.getText();
      const connectionId = await vscode.window.showInputBox({ prompt: 'Data connection id' });
      if (!connectionId) {
        return;
      }
      try {
        const res = await fetch(`${API_BASE}/publish`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}` },
          body: JSON.stringify({ name: 'vscode-endpoint', connectionId, sql, exposure: 'public' }),
        });
        if (!res.ok) {
          throw new Error(`${res.status} ${await res.text()}`);
        }
        const data = (await res.json()) as { url: string; accessToken: string };
        vscode.window.showInformationMessage(`Published: ${data.url} (token ${data.accessToken})`);
      } catch (e) {
        vscode.window.showErrorMessage(`Publish failed: ${String(e)}`);
      }
    })
  );
}

export function deactivate() {}
