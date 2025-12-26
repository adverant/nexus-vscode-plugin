import * as vscode from 'vscode';
import { TestGenerator, type TestFramework } from '../tools/test-generator';
import { MageAgentClient } from '../clients/mageagent-client';
import { TreeSitterService } from '../parsers/tree-sitter-service';

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

  // Detect test framework
  const frameworkChoice = await vscode.window.showQuickPick(
    ['jest', 'vitest', 'pytest', 'go-test', 'rust-test', 'junit'],
    {
      placeHolder: 'Select test framework',
    }
  );

  if (!frameworkChoice) {
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

        // Get API config
        const config = vscode.workspace.getConfiguration('nexus');
        const apiKey = await vscode.workspace.getConfiguration().get<string>('nexus-api-key') || '';
        const mageAgentEndpoint = config.get<string>('mageAgentEndpoint', 'https://api.adverant.ai');

        // Initialize services
        const mageAgent = new MageAgentClient(mageAgentEndpoint, apiKey);
        const treeSitter = new TreeSitterService();

        const generator = new TestGenerator(mageAgent, treeSitter);

        const tests = await generator.generateTestsForFunction(
          filePath,
          extractFunctionName(selectedText),
          {
            framework: frameworkChoice as TestFramework,
            includeEdgeCases: true,
            includeMocks: true,
          }
        );

        // Create test file
        const testFileUri = vscode.Uri.file(tests.filePath);

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
          `Generated ${tests.testsGenerated} test cases. What would you like to do?`,
          'Preview',
          'Create File',
          'Append to Existing',
          'Cancel'
        );

        if (action === 'Preview') {
          const doc = await vscode.workspace.openTextDocument({
            content: tests.content,
            language: editor.document.languageId,
          });

          await vscode.window.showTextDocument(doc, {
            preview: false,
            viewColumn: vscode.ViewColumn.Beside,
          });
        } else if (action === 'Create File') {
          const edit = new vscode.WorkspaceEdit();
          edit.createFile(testFileUri, { overwrite: false });
          edit.insert(testFileUri, new vscode.Position(0, 0), tests.content);

          await vscode.workspace.applyEdit(edit);

          const doc = await vscode.workspace.openTextDocument(testFileUri);
          await vscode.window.showTextDocument(doc);

          vscode.window.showInformationMessage(
            `✅ Test file created: ${tests.filePath}`
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
            `\n\n${tests.content}`
          );

          await vscode.workspace.applyEdit(edit);
          await vscode.window.showTextDocument(doc);

          vscode.window.showInformationMessage(
            `✅ Tests appended to: ${tests.filePath}`
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

// Extract function name from selected text
function extractFunctionName(code: string): string {
  // Try to find function/method name in various formats
  const patterns = [
    /function\s+(\w+)/,           // function name()
    /const\s+(\w+)\s*=/,          // const name =
    /(\w+)\s*=\s*\(/,             // name = ()
    /(\w+)\s*:\s*function/,       // name: function
    /(\w+)\s*\([^)]*\)\s*{/,      // name() {
    /def\s+(\w+)/,                // def name (Python)
    /func\s+(\w+)/,               // func name (Go)
    /fn\s+(\w+)/,                 // fn name (Rust)
    /public\s+\w+\s+(\w+)\s*\(/,  // public type name( (Java)
  ];

  for (const pattern of patterns) {
    const match = code.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  return 'unknownFunction';
}
