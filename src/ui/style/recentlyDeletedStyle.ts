export class RecentlyDeletedStyle {
    private static styleId = 'recently-deleted-styles';
    private static injected = false;
  
    static inject() {
      if (this.injected) return;
  
      const existing = document.getElementById(this.styleId);
      if (existing) {
        existing.remove();
      }
  
      const styleEl = document.createElement('style');
      styleEl.id = this.styleId;
      styleEl.textContent = this.getStyles();
      document.head.appendChild(styleEl);
  
      this.injected = true;
    }
  
    static remove() {
      const styleEl = document.getElementById(this.styleId);
      if (styleEl) {
        styleEl.remove();
      }
      this.injected = false;
    }
  
    private static getStyles(): string {
      return `
          /* 弹窗基础样式 */
    .recently-deleted-modal {
      padding: 0;
    }

    .recently-deleted-modal .modal-content {
      max-height: 80vh;
      overflow-y: auto;
      padding: 20px;
    }

    .recently-deleted-modal .modal-title {
      margin-bottom: 16px;
      padding-bottom: 12px;
      border-bottom: 1px solid var(--background-modifier-border);
    }

    .recently-deleted-modal .modal-title h2 {
      margin: 0;
      font-size: 1.3em;
      font-weight: 600;
    }

    
        .recently-deleted-container {
          padding: 20px;
          height: 100%;
          overflow-y: auto;
        }
  
        .recently-deleted-toolbar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px;
          background: var(--background-secondary);
          border-radius: 8px;
          margin-bottom: 20px;
        }
  
        .deleted-stats {
          font-size: 0.9em;
          color: var(--text-muted);
        }
  
        .deleted-actions {
          display: flex;
          gap: 8px;
        }
  
        .deleted-section {
          margin-bottom: 32px;
        }
  
        .section-header {
          margin-bottom: 16px;
        }
  
        .section-header h3 {
          margin: 0;
          font-size: 1.1em;
          font-weight: 600;
        }
  
        .deleted-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
  
        .deleted-item {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          padding: 16px;
          background: var(--background-primary);
          border: 1px solid var(--background-modifier-border);
          border-radius: 8px;
          transition: all 0.2s ease;
        }
  
        .deleted-item:hover {
          border-color: var(--interactive-accent);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }
  
        .deleted-item-info {
          flex: 1;
          min-width: 0;
          margin-right: 16px;
        }
  
        .deleted-item-content {
          margin-bottom: 8px;
          color: var(--text-normal);
          line-height: 1.5;
          word-break: break-word;
        }
  
        .card-front, 
        .card-back {
          margin: 4px 0;
          font-size: 0.95em;
        }
  
        .card-front strong,
        .card-back strong {
          color: var(--text-accent);
        }
  
        .deleted-item-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          font-size: 0.85em;
          color: var(--text-muted);
        }
  
        .deleted-item-meta span {
          display: inline-flex;
          align-items: center;
          gap: 4px;
        }
  
        .deleted-time {
          color: var(--text-accent);
        }
  
        .deleted-reason {
          padding: 2px 8px;
          background: var(--background-secondary);
          border-radius: 4px;
          font-size: 0.9em;
        }
  
        .deleted-item-actions {
          display: flex;
          gap: 8px;
          align-items: flex-start;
          flex-shrink: 0;
        }
  
        .empty-deleted {
          text-align: center;
          padding: 60px 20px;
        }
  
        .empty-icon {
          font-size: 4em;
          margin-bottom: 16px;
          opacity: 0.5;
        }
  
        .empty-text {
          font-size: 1.2em;
          margin-bottom: 8px;
          color: var(--text-normal);
          font-weight: 500;
        }
  
        .empty-hint {
          color: var(--text-muted);
          font-size: 0.9em;
        }
  
        /* 响应式设计 */
        @media (max-width: 768px) {
          .recently-deleted-container {
            padding: 12px;
          }
  
          .deleted-item {
            flex-direction: column;
            gap: 12px;
          }
  
          .deleted-item-info {
            margin-right: 0;
          }
  
          .deleted-item-actions {
            width: 100%;
            justify-content: flex-end;
          }
        }
      `;
    }
  }