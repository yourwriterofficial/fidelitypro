import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { toast } from 'sonner';
import { Edit, Save, X, Eye, Mail, Code2, FileText, RefreshCw } from 'lucide-react';

interface Template {
  id: string; name: string; subject: string;
  body_html: string; body_text: string; updated_at: string;
}

const VARIABLES = ['{{name}}','{{amount}}','{{site_url}}','{{plan_name}}','{{daily_return}}','{{duration_days}}','{{address}}'];

const DEFAULT_TEMPLATES = [
  {
    name: 'Welcome Email',
    subject: 'Welcome to RPM!',
    body_text: 'Hello {{name}},\n\nWelcome to RPM (Rema Profit Machine)! Your account has been successfully created. You can now log in and start your wealth-building journey at {{site_url}}.\n\nBest regards,\nRPM Team',
    body_html: `<div style="font-family: 'Inter', Helvetica, Arial, sans-serif; background-color: #f9fafb; padding: 40px 20px; color: #1f2937;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05); border: 1px solid #f3f4f6;">
    <div style="background-color: #0f172a; padding: 32px; text-align: center;">
      <span style="color: #ffffff; font-size: 24px; font-weight: 800; letter-spacing: -0.5px; font-family: sans-serif;">RPM</span>
    </div>
    <div style="padding: 40px 32px;">
      <h2 style="font-size: 20px; font-weight: 700; color: #111827; margin-top: 0; margin-bottom: 16px;">Welcome to RPM (Rema Profit Machine), {{name}}!</h2>
      <p style="font-size: 15px; line-height: 1.6; color: #4b5563; margin-bottom: 24px;">We are thrilled to welcome you to our community. Your account has been created and verified. You are now ready to start your smart wealth-building journey.</p>
      <div style="text-align: center; margin-bottom: 32px;">
        <a href="{{site_url}}/login" style="display: inline-block; background-color: #10b981; color: #ffffff; padding: 14px 28px; font-weight: 600; font-size: 15px; border-radius: 12px; text-decoration: none; box-shadow: 0 4px 6px -1px rgba(16, 185, 129, 0.2);">Access Dashboard</a>
      </div>
      <p style="font-size: 14px; line-height: 1.5; color: #6b7280; margin-bottom: 0;">If you have any questions or need assistance, please feel free to reply to this email. Our support team is here 24/7.</p>
    </div>
    <div style="background-color: #f3f4f6; padding: 24px; text-align: center; border-top: 1px solid #e5e7eb;">
      <p style="font-size: 12px; color: #9ca3af; margin: 0;">&copy; 2026 RPM. All rights reserved.</p>
    </div>
  </div>
</div>`
  },
  {
    name: 'Deposit Confirmed',
    subject: 'Deposit Confirmed - RPM',
    body_text: 'Hello {{name}},\n\nYour deposit of {{amount}} has been successfully processed and credited to your wallet balance. You can view this in your dashboard at {{site_url}}.\n\nBest regards,\nRPM Team',
    body_html: `<div style="font-family: 'Inter', Helvetica, Arial, sans-serif; background-color: #f9fafb; padding: 40px 20px; color: #1f2937;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05); border: 1px solid #f3f4f6;">
    <div style="background-color: #0f172a; padding: 32px; text-align: center;">
      <span style="color: #ffffff; font-size: 24px; font-weight: 800; letter-spacing: -0.5px; font-family: sans-serif;">RPM</span>
    </div>
    <div style="padding: 40px 32px;">
      <h2 style="font-size: 20px; font-weight: 700; color: #111827; margin-top: 0; margin-bottom: 16px;">Deposit Successful!</h2>
      <p style="font-size: 15px; line-height: 1.6; color: #4b5563; margin-bottom: 24px;">Hi {{name}}, your deposit has been credited to your account.</p>
      <div style="background-color: #f9fafb; border: 1px solid #f3f4f6; border-radius: 12px; padding: 20px; margin-bottom: 24px; text-align: center;">
        <span style="font-size: 14px; color: #6b7280; display: block; margin-bottom: 4px;">Amount Credited</span>
        <span style="font-size: 28px; font-weight: 800; color: #10b981;">\${{amount}}</span>
      </div>
      <div style="text-align: center; margin-bottom: 32px;">
        <a href="{{site_url}}/app/wallet" style="display: inline-block; background-color: #10b981; color: #ffffff; padding: 14px 28px; font-weight: 600; font-size: 15px; border-radius: 12px; text-decoration: none;">View Wallet Balance</a>
      </div>
    </div>
    <div style="background-color: #f3f4f6; padding: 24px; text-align: center; border-top: 1px solid #e5e7eb;">
      <p style="font-size: 12px; color: #9ca3af; margin: 0;">&copy; 2026 RPM. All rights reserved.</p>
    </div>
  </div>
</div>`
  },
  {
    name: 'Withdrawal Approved',
    subject: 'Withdrawal Request Approved - RPM',
    body_text: 'Hello {{name}},\n\nYour withdrawal request for {{amount}} has been approved. The funds have been sent to your address: {{address}}.\n\nBest regards,\nRPM Team',
    body_html: `<div style="font-family: 'Inter', Helvetica, Arial, sans-serif; background-color: #f9fafb; padding: 40px 20px; color: #1f2937;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05); border: 1px solid #f3f4f6;">
    <div style="background-color: #0f172a; padding: 32px; text-align: center;">
      <span style="color: #ffffff; font-size: 24px; font-weight: 800; letter-spacing: -0.5px; font-family: sans-serif;">RPM</span>
    </div>
    <div style="padding: 40px 32px;">
      <h2 style="font-size: 20px; font-weight: 700; color: #111827; margin-top: 0; margin-bottom: 16px;">Withdrawal Approved!</h2>
      <p style="font-size: 15px; line-height: 1.6; color: #4b5563; margin-bottom: 24px;">Hi {{name}}, your request to withdraw funds has been approved and processed.</p>
      <div style="background-color: #f9fafb; border: 1px solid #f3f4f6; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 14px;"><span style="color: #6b7280;">Amount</span><span style="font-weight: 700; color: #111827;">\${{amount}}</span></div>
        <div style="display: flex; justify-content: space-between; font-size: 14px;"><span style="color: #6b7280;">Destination Address</span><span style="font-weight: 700; color: #111827; font-family: monospace; word-break: break-all;">{{address}}</span></div>
      </div>
      <p style="font-size: 14px; color: #6b7280; line-height: 1.5;">Please allow a few minutes for the transaction to confirm on the blockchain network.</p>
    </div>
    <div style="background-color: #f3f4f6; padding: 24px; text-align: center; border-top: 1px solid #e5e7eb;">
      <p style="font-size: 12px; color: #9ca3af; margin: 0;">&copy; 2026 RPM. All rights reserved.</p>
    </div>
  </div>
</div>`
  },
  {
    name: 'Investment Activated',
    subject: 'Investment Plan Activated - RPM',
    body_text: 'Hello {{name}},\n\nYour investment in the {{plan_name}} has been successfully activated. You will earn {{daily_return}}% daily for {{duration_days}} days on your principal of {{amount}}.\n\nBest regards,\nRPM Team',
    body_html: `<div style="font-family: 'Inter', Helvetica, Arial, sans-serif; background-color: #f9fafb; padding: 40px 20px; color: #1f2937;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05); border: 1px solid #f3f4f6;">
    <div style="background-color: #0f172a; padding: 32px; text-align: center;">
      <span style="color: #ffffff; font-size: 24px; font-weight: 800; letter-spacing: -0.5px; font-family: sans-serif;">RPM</span>
    </div>
    <div style="padding: 40px 32px;">
      <h2 style="font-size: 20px; font-weight: 700; color: #111827; margin-top: 0; margin-bottom: 16px;">Investment Activated!</h2>
      <p style="font-size: 15px; line-height: 1.6; color: #4b5563; margin-bottom: 24px;">Hi {{name}}, your subscription to our premium investment plan is now active.</p>
      <div style="background-color: #f9fafb; border: 1px solid #f3f4f6; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 14px;"><span style="color: #6b7280;">Selected Plan</span><span style="font-weight: 700; color: #111827;">{{plan_name}}</span></div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 14px;"><span style="color: #6b7280;">Principal Amount</span><span style="font-weight: 700; color: #111827;">\${{amount}}</span></div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 14px;"><span style="color: #6b7280;">Daily Yield</span><span style="font-weight: 700; color: #10b981;">{{daily_return}}% Daily</span></div>
        <div style="display: flex; justify-content: space-between; font-size: 14px;"><span style="color: #6b7280;">Term Duration</span><span style="font-weight: 700; color: #111827;">{{duration_days}} Days</span></div>
      </div>
      <div style="text-align: center; margin-bottom: 32px;">
        <a href="{{site_url}}/app/my-portfolio" style="display: inline-block; background-color: #10b981; color: #ffffff; padding: 14px 28px; font-weight: 600; font-size: 15px; border-radius: 12px; text-decoration: none;">Track Performance</a>
      </div>
    </div>
    <div style="background-color: #f3f4f6; padding: 24px; text-align: center; border-top: 1px solid #e5e7eb;">
      <p style="font-size: 12px; color: #9ca3af; margin: 0;">&copy; 2026 RPM. All rights reserved.</p>
    </div>
  </div>
</div>`
  },
  {
    name: 'Inactivity Warning',
    subject: 'Account Inactivity Warning - Action Required',
    body_text: 'Hello {{name}},\n\nYour account has been flagged for inactivity as you have not made any investments yet. Please top up your wallet and start an investment within the allowed grace period to avoid account restrictions.\n\nBest regards,\nRPM Team',
    body_html: `<div style="font-family: 'Inter', Helvetica, Arial, sans-serif; background-color: #f9fafb; padding: 40px 20px; color: #1f2937;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05); border: 1px solid #f3f4f6;">
    <div style="background-color: #0f172a; padding: 32px; text-align: center;">
      <span style="color: #ffffff; font-size: 24px; font-weight: 800; letter-spacing: -0.5px; font-family: sans-serif;">RPM</span>
    </div>
    <div style="padding: 40px 32px;">
      <h2 style="font-size: 20px; font-weight: 700; color: #ef4444; margin-top: 0; margin-bottom: 16px;">Inactivity Warning</h2>
      <p style="font-size: 15px; line-height: 1.6; color: #4b5563; margin-bottom: 24px;">Hi {{name}}, our system detected that your account does not have any active investments. Our platform is strictly for active investors.</p>
      <p style="font-size: 15px; line-height: 1.6; color: #4b5563; margin-bottom: 24px;">Please top up your wallet and start an investment within the grace period to keep full account access.</p>
      <div style="text-align: center; margin-bottom: 32px;">
        <a href="{{site_url}}/app/wallet" style="display: inline-block; background-color: #10b981; color: #ffffff; padding: 14px 28px; font-weight: 600; font-size: 15px; border-radius: 12px; text-decoration: none;">Top Up Wallet Now</a>
      </div>
    </div>
    <div style="background-color: #f3f4f6; padding: 24px; text-align: center; border-top: 1px solid #e5e7eb;">
      <p style="font-size: 12px; color: #9ca3af; margin: 0;">&copy; 2026 RPM. All rights reserved.</p>
    </div>
  </div>
</div>`
  }
];

export default function EmailTemplates() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<Template>>({});
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'html'|'text'>('html');

  const fetchTemplates = async () => {
    const { data, error } = await supabase.from('email_templates').select('*').order('name');
    if (error) toast.error('Failed to load templates');
    else setTemplates(data || []);
    setLoading(false);
  };

  const handleSeedTemplates = async () => {
    if (!window.confirm('This will seed/overwrite the default templates. Proceed?')) return;
    setSeeding(true);
    try {
      // Clean up old FidelityPro templates from the database
      const oldTemplateNames = ['deposit_confirmation', 'investment_activated', 'withdrawal_approved', 'low_balance_warning'];
      await supabase.from('email_templates').delete().in('name', oldTemplateNames);

      for (const t of DEFAULT_TEMPLATES) {
        const { data: existing } = await supabase
          .from('email_templates')
          .select('id')
          .eq('name', t.name)
          .maybeSingle();

        if (existing) {
          const { error } = await supabase
            .from('email_templates')
            .update({
              subject: t.subject,
              body_html: t.body_html,
              body_text: t.body_text,
              updated_at: new Date().toISOString()
            })
            .eq('id', existing.id);
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from('email_templates')
            .insert({
              name: t.name,
              subject: t.subject,
              body_html: t.body_html,
              body_text: t.body_text,
              updated_at: new Date().toISOString()
            });
          if (error) throw error;
        }
      }
      toast.success('Email templates successfully seeded!');
      await fetchTemplates();
    } catch (err: any) {
      toast.error('Failed to seed templates: ' + err.message);
    } finally {
      setSeeding(false);
    }
  };

  useEffect(() => { fetchTemplates(); }, []);


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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Email Templates</h1>
          <p className="text-sm text-gray-500 mt-0.5">Edit system email templates · Use <code className="bg-gray-100 px-1 rounded text-xs">{'{{variable}}'}</code> placeholders</p>
        </div>
        <button onClick={handleSeedTemplates} disabled={seeding}
          className="bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 px-4 py-2.5 rounded-xl flex items-center gap-2 text-sm font-medium transition disabled:opacity-60 shadow-sm">
          <RefreshCw size={15} className={seeding ? 'animate-spin' : ''} /> Seed / Reset Defaults
        </button>
      </div>

      {loading && templates.length === 0 ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="animate-pulse h-20 bg-gray-100 rounded-2xl" />)}</div>
      ) : templates.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 py-14 text-center">
          <Mail size={32} className="text-gray-200 mx-auto mb-2" />
          <p className="text-gray-400 text-sm">No email templates found.</p>
          <button onClick={handleSeedTemplates} disabled={seeding}
            className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-brand text-white hover:bg-brand-dark rounded-xl text-sm font-semibold transition disabled:opacity-60 shadow-sm">
            Seed Default Templates
          </button>
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
