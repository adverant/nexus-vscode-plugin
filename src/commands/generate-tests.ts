import * as vscode from 'vscode';
import { generateTests } from '../tools/test-generator';

export async function generateTestsCommand() {
  const editor = vscode.window.activeTextEditor;

  if (!editor) {
    vscode.window.showErrorMessage('No active editor');
    return;
  }

  const selection = editor.selection;
  const selectedText = editor.document.getText(selection);

  if (!selectedText) {
    vscode.window.showErrorMessage('No code selected');
    return;
  }

  const filePath = editor.document.uri.fsPath;
  const language = editor.document.languageId;

  // Detect test framework
  const framework = await vscode.window.showQuickPick(
    ['Jest', 'Vitest', 'Pytest', 'Go Test', 'Rust Test', 'JUnit'],
    {
      placeHolder: 'Select test framework',
    }
  );

  if (!framework) {
    return;
  }

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: 'Generating Tests',
      cancellable: false,
    },
    async (progress) => {
      try {
        progress.report({ message: 'Analyzing code...' });

        const tests = await generateTests({
          code: selectedText,
          language,
          framework: framework.toLowerCase().replace(' ', '-'),
          filePath,
        });

        // Create test file
        const testFilePath = getTestFilePath(filePath, language);
        const testFileUri = vscode.Uri.file(testFilePath);

        // Check if test file exists
        let existingContent = '';
        try {
          const doc = await vscode.workspace.openTextDocument(testFileUri);
          existingContent = doc.getText();
        } catch {
          // File doesn't exist, that's okay
        }

        // Show preview
        const action = await vscode.window.showInformationMessage(
          `Generated ${tests.testCases?.length || 0} test cases. What would you like to do?`,
          'Preview',
          'Create File',
          'Append to Existing',
          'Cancel'
        );

        if (action === 'Preview') {
          const doc = await vscode.workspace.openTextDocument({
            content: tests.testCode,
            language: tests.language,
          });

          await vscode.window.showTextDocument(doc, {
            preview: false,
            viewColumn: vscode.ViewColumn.Beside,
          });
        } else if (action === 'Create File') {
          const edit = new vscode.WorkspaceEdit();
          edit.createFile(testFileUri, { overwrite: false });
          edit.insert(testFileUri, new vscode.Position(0, 0), tests.testCode);

          await vscode.workspace.applyEdit(edit);

          const doc = await vscode.workspace.openTextDocument(testFileUri);
          await vscode.window.showTextDocument(doc);

          vscode.window.showInformationMessage(
            `✅ Test file created: ${testFilePath}`
          );
        } else if (action === 'Append to Existing') {
          if (!existingContent) {
            vscode.window.showErrorMessage('No existing test file found');
            return;
          }

          const doc = await vscode.workspace.openTextDocument(testFileUri);
          const edit = new vscode.WorkspaceEdit();
          const lastLine = doc.lineCount;

          edit.insert(
            testFileUri,
            new vscode.Position(lastLine, 0),
            `\n\n${tests.testCode}`
          );

          await vscode.workspace.applyEdit(edit);
          await vscode.window.showTextDocument(doc);

          vscode.window.showInformationMessage(
            `✅ Tests appended to: ${testFilePath}`
          );
        }
      } catch (error) {
        vscode.window.showErrorMessage(
          `Test generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }
  );
}

function getTestFilePath(filePath: string, language: string): string {
  const parts = filePath.split('/');
  const fileName = parts.pop() || '';
  const baseName = fileName.replace(/\.[^/.]+$/, '');

  const extensions: Record<string, string> = {
    typescript: 'test.ts',
    javascript: 'test.js',
    python: 'test.py',
    go: 'test.go',
    rust: 'test.rs',
    java: 'Test.java',
  };

  const ext = extensions[language] || 'test.js';

  // For Java, capitalize and append Test
  if (language === 'java') {
    return [...parts, `${baseName}Test.java`].join('/');
  }

  return [...parts, `${baseName}.${ext}`].join('/');
}
