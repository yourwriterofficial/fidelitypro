import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { toast } from 'sonner';
import { Edit, Save, X, Eye } from 'lucide-react';

interface Template {
  id: string;
  name: string;
  subject: string;
  body_html: string;
  body_text: string;
  updated_at: string;
}

export default function EmailTemplates() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<Template>>({});
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    const { data, error } = await supabase
      .from('email_templates')
      .select('*')
      .order('name');
    if (error) {
      console.error(error);
      toast.error('Failed to load templates');
    } else {
      setTemplates(data || []);
    }
    setLoading(false);
  };

  const handleEdit = (template: Template) => {
    setEditingId(template.id);
    setEditData({ ...template });
    setPreviewHtml(null);
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditData({});
    setPreviewHtml(null);
  };

  const handleSave = async () => {
    if (!editingId || !editData) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from('email_templates')
        .update({
          subject: editData.subject,
          body_html: editData.body_html,
          body_text: editData.body_text,
          updated_at: new Date().toISOString(),
        })
        .eq('id', editingId);
      if (error) throw error;
      toast.success('Template updated');
      setEditingId(null);
      setEditData({});
      await fetchTemplates();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePreview = () => {
    if (!editData.body_html) return;
    let html = editData.body_html
      .replace(/{{name}}/g, 'John Doe')
      .replace(/{{amount}}/g, '500.00')
      .replace(/{{site_url}}/g, window.location.origin)
      .replace(/{{plan_name}}/g, 'Starter Plan')
      .replace(/{{daily_return}}/g, '2.5')
      .replace(/{{duration_days}}/g, '30')
      .replace(/{{address}}/g, '0x1234567890abcdef...');
    setPreviewHtml(html);
  };

  if (loading && templates.length === 0) return <div>Loading templates...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Email Templates</h1>
        <p className="text-sm text-gray-500">Edit system email templates. Use {'{{variable}}'} placeholders.</p>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {templates.map((template) => (
          <div key={template.id} className="bg-white rounded-2xl shadow-sm border p-6">
            {editingId === template.id ? (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-semibold">{template.name}</h2>
                  <div className="flex gap-2">
                    <button onClick={handlePreview} className="px-3 py-1 bg-blue-100 text-blue-700 rounded-xl flex items-center gap-1"><Eye size={16} /> Preview</button>
                    <button onClick={handleSave} disabled={loading} className="px-3 py-1 bg-brand text-white rounded-xl flex items-center gap-1"><Save size={16} /> Save</button>
                    <button onClick={handleCancel} className="px-3 py-1 bg-gray-200 rounded-xl flex items-center gap-1"><X size={16} /> Cancel</button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Subject</label>
                  <input
                    type="text"
                    value={editData.subject || ''}
                    onChange={(e) => setEditData({ ...editData, subject: e.target.value })}
                    className="w-full border border-gray-300 rounded-xl px-4 py-2 focus:ring-2 focus:ring-brand"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">HTML Body</label>
                  <textarea
                    value={editData.body_html || ''}
                    onChange={(e) => setEditData({ ...editData, body_html: e.target.value })}
                    rows={10}
                    className="w-full border border-gray-300 rounded-xl px-4 py-2 focus:ring-2 focus:ring-brand font-mono text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Plain Text (optional)</label>
                  <textarea
                    value={editData.body_text || ''}
                    onChange={(e) => setEditData({ ...editData, body_text: e.target.value })}
                    rows={4}
                    className="w-full border border-gray-300 rounded-xl px-4 py-2 focus:ring-2 focus:ring-brand font-mono text-sm"
                  />
                </div>
                <div className="text-xs text-gray-500">Available variables: <code className="bg-gray-100 px-1 rounded">{'{{name}}, {{amount}}, {{site_url}}, {{plan_name}}, {{daily_return}}, {{duration_days}}, {{address}}'}</code></div>
              </div>
            ) : (
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-semibold">{template.name}</h3>
                  <p className="text-sm text-gray-500">Subject: {template.subject}</p>
                  <p className="text-xs text-gray-400">Updated: {new Date(template.updated_at).toLocaleString()}</p>
                </div>
                <button onClick={() => handleEdit(template)} className="p-2 hover:bg-gray-100 rounded-xl"><Edit size={20} /></button>
              </div>
            )}
          </div>
        ))}
      </div>

      {previewHtml && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 relative max-h-[90vh] overflow-auto">
            <button onClick={() => setPreviewHtml(null)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><X size={24} /></button>
            <h2 className="text-xl font-bold mb-4">Preview</h2>
            <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
            <button onClick={() => setPreviewHtml(null)} className="mt-4 bg-gray-200 px-6 py-2 rounded-xl">Close</button>
          </div>
        </div>
      )}
    </div>
  );
} 