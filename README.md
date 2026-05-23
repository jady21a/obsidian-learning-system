# Learning System

Turn your Obsidian notes into a long-term, reviewable learning system.

>   **中文readme**: [点击查看中文版](README_CH.md)

---

## Why Learning System?

You’ve written a lot of notes in Obsidian, but later realized that:

- Most of the content is forgotten quickly
- Notes are rarely reviewed again

**Learning System** aims to upgrade note-taking into a  
**sustainable, active learning system** that actually helps you remember and grow.

---

## Core Concepts

📥 **Capture**  
Extract truly valuable and memorable content from your notes

🧠 **Process**  
Automatically generate Q&A cards and Cloze (fill-in-the-blank) cards

🔄 **Review**  
Trigger review flows and reminders based on real learning behavior

📊 **Analyze**  
Use data to reflect your learning effort and review progress

---

## Features Overview

### Content Extraction

- Extract from selected text / current file / entire vault
    
- Batch extraction and table extraction supported
    
- Multiple card types: Text / Q&A / Cloze
    

### Annotation System

- Add your own understanding and reflections to extracted content
    
- Keyboard-driven, fast annotation editing
    

### Review System

- Spaced-repetition–inspired review workflow
    
- Keyboard-first, efficient review interface
    
- Review reminders triggered by actual learning behavior
    

### Learning Analytics

- Review progress tracking
    
- Learning behavior insights
    
- Filter by file / tag / date
    

---

## Milestones

All features are available from day one — no gating. As you use the plugin you
collect **milestones** (achievements) that celebrate progress:

- 🌱 First extraction · 📊 Visit statistics page
- 📄 Extract as Text ×5 · ❓ Extract as Q&A ×5 · ⬛ Extract as Cloze ×5 · 🔍 Scan 10 notes
- 📦 Extract 30 cards · 📝 Add 10 annotations · 📋 Scan 5 tables · 🔥 7-day streak
- 🔄 Review 50 cards · 📅 21 active days
- 🎯 Review 150 cards

When you reach a milestone you get a one-time congratulation notice. Run the
**Learning System: Show milestones** command to view the full list with progress.

---

## Installation

**Community Plugins** (once approved): Settings → **Community Plugins → Browse** → search **Learning System** → Install and enable.

**Manual install** (available now): download `manifest.json`, `main.js`, and `styles.css` from [GitHub Releases](https://github.com/jady21a/obsidian-learning-system/releases) and place them in `.obsidian/plugins/learning-system/`, then enable in Settings → Community Plugins.

> Community-directory listing is pending review. Until then, use the manual install above (or BRAT).

---

## Experimental: Mindmap

An opt-in **Mindmap** feature is included but **disabled by default**. Enable it in
**Settings → Learning System → Experimental → Mindmap**. It lets you open a note or
selection as an editable mindmap and review cloze cards in mindmap form.

> Note: creating clozes from a mindmap writes block ids (`^id`) into your notes.
> The feature is still evolving — keep it off if you prefer a stable workflow.

---

## Usage

1. Open the sidebar via command:  
    **Learning System: Open Learning Overview (Sidebar)**
2. Extract notes and generate flashcards (annotations optional)
3. Use  
    **Learning System: Toggle Learning Overview (Main View)**  
    to view all extracted content
4. Start reviewing
5. Check learning statistics

---

## Keyboard Shortcuts

### Annotation

- `Tab` — Save annotation
### Review
- `Tab` — Forward
- `Shift + Tab` — Backward
- `1` — Again
- `2` — Hard
- `3` — Good
- `4` — Easy
---

## Roadmap

### Planned Features

-  **Think Tank / Community Learning System**  
    👉 [Learn more](https://jz-quartz.pages.dev/6.about/%E6%99%BA%E5%9B%A2%E5%9B%A2)
-  Mind-map style review *(shipped as experimental — enable in Settings)*
-  Mobile experience optimization

---

## Privacy & Data

All data is stored locally and used only for the plugin’s functionality.  
Your notes are **never uploaded**.

---

## Support & Feedback

- Feel free to submit issues or suggestions via GitHub Issues
- Your feedback is crucial to the evolution of this plugin 🙌

---

## License

MIT License  
See [LICENSE](LICENSE)
