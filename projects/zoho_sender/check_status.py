#!/usr/bin/env python3
import sqlite3

conn = sqlite3.connect('zoho_sender.db')
cursor = conn.cursor()

# Get total count
cursor.execute('SELECT COUNT(*) FROM registered')
total = cursor.fetchone()[0]

# Get sent count
cursor.execute("SELECT COUNT(*) FROM registered WHERE status='sent'")
sent = cursor.fetchone()[0]

# Get pending count
cursor.execute("SELECT COUNT(*) FROM registered WHERE status='pending'")
pending = cursor.fetchone()[0]

conn.close()

print(f'✅ إجمالي الإيميلات: {total}')
print(f'📤 الإيميلات المرسلة: {sent}')
print(f'⏳ الإيميلات المعلقة: {pending}')
print(f'\n🔄 نسبة الإنجاز: {(sent/total)*100:.1f}%' if total > 0 else '')
