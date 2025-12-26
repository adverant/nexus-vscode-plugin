# 🚨 HOW TO OPEN THE NEXUS PANEL

## YOU'RE LOOKING AT THE SIDEBAR - NOT THE MAIN UI!

### What You're Seeing Now ❌
The **sidebar tree view** with:
- MEMORIES section
- NEXUSMIND section
- List of visualization commands

This is just **navigation** - it's supposed to look simple!

---

## The REAL UI is in the WebView Panel ✅

### How to See the Beautiful UI:

## METHOD 1: Click Any Visualization ⭐ EASIEST
1. Look at the **NEXUSMIND** section in your sidebar
2. Click on **"📊 Dependency Graph"** (or any visualization)
3. A **NEW TAB** will open with the full UI!

## METHOD 2: Keyboard Shortcut ⚡ FASTEST
```
Press: Cmd+Shift+N
```
A new tab opens immediately!

## METHOD 3: Command Palette
```
Cmd+Shift+P
Type: "Nexus: Open Panel"
Press: Enter
```

---

## What the Panel Looks Like

When it opens, you'll see a **COMPLETELY DIFFERENT UI** with:

### Top: Horizontal Tabs
```
┌─────────────────────────────────────────────────────┐
│  Dashboard | Visualizations | Code Intelligence | Security  │
└─────────────────────────────────────────────────────┘
```

### Dashboard Tab Content:
```
┌──────────────────────────────────────────┐
│ 🟢 API Status: Connected                 │
└──────────────────────────────────────────┘

┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐
│ 💾 Store│ │ 🔍Recall│ │ 📦Index │ │ 💬Query │
│  Memory │ │  Memory │ │   Repo  │ │  Graph  │
└─────────┘ └─────────┘ └─────────┘ └─────────┘

┌──────────────────────────────────────────┐
│ 📚 Recent Memories                       │
│  - memory 1                              │
│  - memory 2                              │
└──────────────────────────────────────────┘

┌──────────────────────────────────────────┐
│ 📊 Repository Stats                      │
│  Files: --  Entities: --  Relations: -- │
└──────────────────────────────────────────┘
```

### This looks NOTHING like the tree view!

---

## Troubleshooting

### If Nothing Happens When You Click:

#### 1. Check for Errors
Open Developer Tools:
```
Help → Toggle Developer Tools
```
Look in the **Console** tab for red errors.

#### 2. Check Extension is Active
Bottom left corner should show "Nexus activated! GraphRAG code intelligence ready 🚀"

#### 3. Try the Command Directly
```
Cmd+Shift+P → "Nexus: Open Panel"
```

If you see an error like "command 'nexus.openPanel' not found":
- Extension didn't activate
- Reload window: Cmd+Shift+P → "Developer: Reload Window"

#### 4. Check Extension Console
```
View → Output
Select "Nexus" from dropdown
```
Look for activation messages or errors.

---

## The Panel is a SEPARATE TAB

Just like when you open a file, the panel opens as a **new editor tab**.

It will appear:
- **Next to your other open files**
- **As a tab** at the top of the editor area
- **NOT in the sidebar** - that's just navigation!

---

## Visual Comparison

### Sidebar (What You're Seeing):
- Tree structure
- Small icons
- Text labels
- Expandable sections
- No buttons or forms
- **This is just navigation!**

### WebView Panel (What You Should Open):
- Full-width tabs
- Large buttons and cards
- Input fields and dropdowns
- Professional styled UI
- Forms and visualizations
- **This is the actual UI!**

---

## TL;DR

**RIGHT NOW:**
1. Press `Cmd+Shift+N`
2. Watch a new tab open
3. See the beautiful 4-tab UI

**THAT'S IT!**

The sidebar is fine - it's just there for quick navigation.
The main UI is in the panel that opens as a tab.

---

## Still Not Working?

Run this command in the VSCode terminal:
```
code --list-extensions | grep nexus
```

Should show:
```
adverant.nexus-vscode-plugin@0.1.0
```

If not shown:
```
code --install-extension /Users/don/Adverant/nexus-vscode-plugin/nexus-vscode-plugin-0.1.0.vsix --force
```

Then:
```
Cmd+Shift+P → "Developer: Reload Window"
```

Then:
```
Cmd+Shift+N
```

DONE!
