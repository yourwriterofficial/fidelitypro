import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { toast } from 'sonner';
import { Edit, Save, X, Eye, Mail, Code2, FileText } from 'lucide-react';

interface Template {
  id: string; name: string; subject: string;
  body_html: string; body_text: string; updated_at: string;
}

const VARIABLES = ['{{name}}','{{amount}}','{{site_url}}','{{plan_name}}','{{daily_return}}','{{duration_days}}','{{address}}'];

export default function EmailTemplates() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<Template>>({});
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'html'|'text'>('html');

  useEffect(() => { fetchTemplates(); }, []);

  const fetchTemplates = async () => {
    const { data, error } = await supabase.from('email_templates').select('*').order('name');
    if (error) toast.error('Failed to load templates');
    else setTemplates(data || []);
    setLoading(false);
  };

  const handleEdit = (template: Template) => {
    setEditingId(template.id);
    setEditData({ ...template });
    setPreviewHtml(null);
    setActiveTab('html');
  };

  const handleCancel = () => { setEditingId(null); setEditData({}); setPreviewHtml(null); };

  const handleSave = async () => {
    if (!editingId || !editData) return;
    setLoading(true);
    try {
      const { error } = await supabase.from('email_templates').update({
        subject: editData.subject,
        body_html: editData.body_html,
        body_text: editData.body_text,
        updated_at: new Date().toISOString(),
      }).eq('id', editingId);
      if (error) throw error;
      toast.success('Template saved');
      setEditingId(null); setEditData({});
      await fetchTemplates();
    } catch (err: any) { toast.error(err.message); }
    finally { setLoading(false); }
  };

  const handlePreview = () => {
    if (!editData.body_html) return;
    const html = editData.body_html
      .replace(/{{name}}/g, 'John Doe')
      .replace(/{{amount}}/g, '500.00')
      .replace(/{{site_url}}/g, window.location.origin)
      .replace(/{{plan_name}}/g, 'Starter Plan')
      .replace(/{{daily_return}}/g, '2.5')
      .replace(/{{duration_days}}/g, '30')
      .replace(/{{address}}/g, '0x1234567890abcdef...');
    setPreviewHtml(html);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Email Templates</h1>
        <p className="text-sm text-gray-500 mt-0.5">Edit system email templates · Use <code className="bg-gray-100 px-1 rounded text-xs">{'{{variable}}'}</code> placeholders</p>
      </div>

      {loading && templates.length === 0 ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="animate-pulse h-20 bg-gray-100 rounded-2xl" />)}</div>
      ) : templates.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 py-14 text-center">
          <Mail size={32} className="text-gray-200 mx-auto mb-2" />
          <p className="text-gray-400 text-sm">No email templates found.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {templates.map(template => (
            <div key={template.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              {editingId === template.id ? (
                <>
                  <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/50">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-brand/10 rounded-lg"><Mail size={14} className="text-brand" /></div>
                      <h2 className="font-semibold text-gray-900">{template.name}</h2>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={handlePreview} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg text-xs font-medium transition">
                        <Eye size={13} /> Preview
                      </button>
                      <button onClick={handleSave} disabled={loading} className="flex items-center gap-1.5 px-3 py-1.5 bg-brand text-white hover:bg-brand-dark rounded-lg text-xs font-semibold transition disabled:opacity-60">
                        <Save size={13} /> Save
                      </button>
                      <button onClick={handleCancel} className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-600 hover:bg-gray-200 rounded-lg text-xs transition">
                        <X size={13} /> Cancel
                      </button>
                    </div>
                  </div>
                  <div className="p-6 space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Subject Line</label>
                      <input type="text" value={editData.subject || ''} onChange={e => setEditData({ ...editData, subject: e.target.value })}
                        className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-brand focus:border-transparent" />
                    </div>
                    <div>
                      <div className="flex items-center gap-1 mb-2">
                        <button onClick={() => setActiveTab('html')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${activeTab === 'html' ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-100'}`}>
                          <Code2 size={12} /> HTML Body
                        </button>
                        <button onClick={() => setActiveTab('text')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${activeTab === 'text' ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-100'}`}>
                          <FileText size={12} /> Plain Text
                        </button>
                      </div>
                      {activeTab === 'html' ? (
                        <textarea value={editData.body_html || ''} onChange={e => setEditData({ ...editData, body_html: e.target.value })} rows={12}
                          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm font-mono focus:ring-2 focus:ring-brand focus:border-transparent resize-y" placeholder="HTML email body..." />
                      ) : (
                        <textarea value={editData.body_text || ''} onChange={e => setEditData({ ...editData, body_text: e.target.value })} rows={6}
                          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm font-mono focus:ring-2 focus:ring-brand focus:border-transparent resize-y" placeholder="Plain text fallback (optional)..." />
                      )}
                    </div>
                    <div className="flex items-start gap-2 p-3 bg-gray-50 rounded-xl">
                      <span className="text-xs text-gray-500 font-medium shrink-0 mt-0.5">Variables:</span>
                      <div className="flex flex-wrap gap-1.5">
                        {VARIABLES.map(v => (
                          <code key={v} className="text-xs bg-white border border-gray-200 text-brand px-1.5 py-0.5 rounded-md">{v}</code>
                        ))}
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-between px-5 py-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2 bg-brand/10 rounded-lg shrink-0"><Mail size={15} className="text-brand" /></div>
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900">{template.name}</p>
                      <p className="text-sm text-gray-500 truncate">{template.subject}</p>
                      <p className="text-xs text-gray-400 mt-0.5">Updated {new Date(template.updated_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</p>
                    </div>
                  </div>
                  <button onClick={() => handleEdit(template)} className="p-2 hover:bg-gray-100 text-gray-400 hover:text-brand rounded-xl transition">
                    <Edit size={16} />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {previewHtml && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-blue-50 rounded-lg"><Eye size={15} className="text-blue-600" /></div>
                <h2 className="font-semibold text-gray-900">Email Preview</h2>
              </div>
              <button onClick={() => setPreviewHtml(null)} className="p-2 hover:bg-gray-100 rounded-xl transition"><X size={16} className="text-gray-400" /></button>
            </div>
            <div className="overflow-y-auto flex-1 p-6">
              <div className="border border-gray-100 rounded-2xl overflow-hidden">
                <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 shrink-0">
              <button onClick={() => setPreviewHtml(null)} className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 py-2.5 rounded-xl text-sm font-medium transition">Close Preview</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
