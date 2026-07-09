import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { toast } from 'sonner';
import { Plus, Edit, Trash, X, Building2 } from 'lucide-react';

const CATEGORY_SUGGESTIONS = ['House', 'Apartment', 'Land', 'Car', 'Business', 'Other'];

const emptyForm = {
  category: 'House',
  title: '',
  description: '',
  price: '',
  down_payment_percent: '20',
  monthly_payment: '',
  term_months: '12',
  status: 'active',
  location: 'Denver, Colorado',
  beds: '3',
  baths: '2.5',
  sqft: '2000',
  garages: '2',
  year: '2020',
  make: 'Toyota',
  car_model: 'Camry',
  mileage: '30000',
  transmission: 'Automatic',
  fuel_type: 'Gasoline',
  interested_count: '0',
  property_url: '',
};

export default function AdminProperties() {
  const [properties, setProperties] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ ...emptyForm });
  // One image URL per input box. Always keep at least one box.
  const [images, setImages] = useState<string[]>(['']);

  useEffect(() => {
    fetchProperties();
  }, []);

  const fetchProperties = async () => {
    const { data, error } = await supabase
      .from('properties')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) toast.error('Failed to load listings');
    else setProperties(data || []);
    setLoading(false);
  };

  const resetForm = () => {
    setForm({ ...emptyForm });
    setImages(['']);
    setEditing(null);
  };

  const updateImage = (i: number, value: string) =>
    setImages(prev => prev.map((u, idx) => (idx === i ? value : u)));
  const addImage = () => setImages(prev => [...prev, '']);
  const removeImage = (i: number) =>
    setImages(prev => (prev.length === 1 ? [''] : prev.filter((_, idx) => idx !== i)));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const priceVal = parseFloat(form.price);
    const downPercentVal = parseFloat(form.down_payment_percent);
    const termMonthsVal = parseInt(form.term_months);
    
    // Auto calculate monthly payment if not specified
    let monthlyPay = form.monthly_payment ? parseFloat(form.monthly_payment) : null;
    if (!monthlyPay && !isNaN(priceVal) && !isNaN(downPercentVal) && !isNaN(termMonthsVal)) {
      monthlyPay = parseFloat(((priceVal * (1 - downPercentVal / 100)) / termMonthsVal).toFixed(2));
    }

    const payload = {
      category: form.category.trim() || 'Other',
      title: form.title,
      description: form.description,
      price: priceVal,
      down_payment_percent: downPercentVal,
      monthly_payment: monthlyPay,
      term_months: termMonthsVal,
      image_urls: images.map(s => s.trim()).filter(Boolean),
      status: form.status,
      location: form.location.trim() || 'Denver, Colorado',
      beds: form.category === 'Car' ? null : (parseInt(form.beds) || null),
      baths: form.category === 'Car' ? null : (parseFloat(form.baths) || null),
      sqft: form.category === 'Car' ? null : (parseInt(form.sqft) || null),
      garages: form.category === 'Car' ? null : (parseInt(form.garages) || null),
      year: form.category === 'Car' ? (parseInt(form.year) || 2020) : null,
      make: form.category === 'Car' ? (form.make.trim() || 'Toyota') : null,
      car_model: form.category === 'Car' ? (form.car_model.trim() || 'Camry') : null,
      mileage: form.category === 'Car' ? (parseInt(form.mileage) || 30000) : null,
      transmission: form.category === 'Car' ? (form.transmission || 'Automatic') : null,
      fuel_type: form.category === 'Car' ? (form.fuel_type || 'Gasoline') : null,
      interested_count: parseInt(form.interested_count) || 0,
      property_url: form.property_url.trim() || null,
    };
    try {
      if (editing) {
        const { error } = await supabase.from('properties').update(payload).eq('id', editing.id);
        if (error) throw error;
        toast.success('Listing updated');
      } else {
        const { error } = await supabase.from('properties').insert(payload);
        if (error) throw error;
        toast.success('Listing created');
      }
      setShowForm(false);
      resetForm();
      fetchProperties();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const openNew = () => { resetForm(); setShowForm(true); };

  const openEdit = (p: any) => {
    setEditing(p);
    setForm({
      category: p.category || 'House',
      title: p.title,
      description: p.description || '',
      price: p.price.toString(),
      down_payment_percent: p.down_payment_percent.toString(),
      monthly_payment: p.monthly_payment ? p.monthly_payment.toString() : '',
      term_months: p.term_months.toString(),
      status: p.status,
      location: p.location || 'Denver, Colorado',
      beds: (p.beds || 3).toString(),
      baths: (p.baths || 2.5).toString(),
      sqft: (p.sqft || 2000).toString(),
      garages: (p.garages || 2).toString(),
      year: (p.year || 2020).toString(),
      make: p.make || 'Toyota',
      car_model: p.car_model || 'Camry',
      mileage: (p.mileage || 30000).toString(),
      transmission: p.transmission || 'Automatic',
      fuel_type: p.fuel_type || 'Gasoline',
      interested_count: (p.interested_count || 0).toString(),
      property_url: p.property_url || '',
    });
    setImages(p.image_urls && p.image_urls.length > 0 ? [...p.image_urls] : ['']);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this listing?')) return;
    const { error } = await supabase.from('properties').delete().eq('id', id);
    if (error) toast.error(error.message);
    else { toast.success('Deleted'); fetchProperties(); }
  };

  const toggleStatus = async (id: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('properties')
        .update({ status: newStatus })
        .eq('id', id);
      if (error) throw error;
      toast.success(`Listing status updated to ${newStatus}`);
      fetchProperties();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Listings</h1>
          <p className="text-sm text-gray-400 mt-0.5">Post houses, cars, land, or any item for installment purchase.</p>
        </div>
        <button onClick={openNew} className="bg-brand text-white px-4 py-2 rounded-xl flex items-center gap-2 shrink-0 self-start sm:self-auto"><Plus size={20} /> New</button>
      </div>

      {showForm && (
        <div className="bg-white rounded-2xl shadow-sm border p-4 md:p-6">
          <h2 className="text-xl font-semibold mb-4">{editing ? 'Edit' : 'New'} Listing</h2>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Category</label>
              <input type="text" list="category-suggestions" placeholder="e.g., House, Car, Land…" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="border rounded-xl px-4 py-2 w-full" required />
              <datalist id="category-suggestions">
                {CATEGORY_SUGGESTIONS.map(c => <option key={c} value={c} />)}
              </datalist>
              <p className="text-xs text-gray-400 mt-1">Type of item. Choose a suggestion or enter your own.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Title</label>
              <input type="text" placeholder="e.g., Luxury Villa / Toyota Camry" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="border rounded-xl px-4 py-2 w-full" required />
              <p className="text-xs text-gray-400 mt-1">Name/Address of the item.</p>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700">Description</label>
              <textarea placeholder="Detailed description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} className="border rounded-xl px-4 py-2 w-full" required />
              <p className="text-xs text-gray-400 mt-1">Describe the item and its features.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Location</label>
              <input type="text" placeholder="e.g., Erie, Colorado" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} className="border rounded-xl px-4 py-2 w-full" required />
              <p className="text-xs text-gray-400 mt-1">Location of the item.</p>
            </div>
            <div>
            {form.category === 'Car' ? (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Year</label>
                  <input type="number" placeholder="2020" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} className="border rounded-xl px-4 py-2 w-full" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Make</label>
                  <input type="text" placeholder="Toyota" value={form.make} onChange={(e) => setForm({ ...form, make: e.target.value })} className="border rounded-xl px-4 py-2 w-full" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Model</label>
                  <input type="text" placeholder="Camry" value={form.car_model} onChange={(e) => setForm({ ...form, car_model: e.target.value })} className="border rounded-xl px-4 py-2 w-full" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Mileage (miles)</label>
                  <input type="number" placeholder="30000" value={form.mileage} onChange={(e) => setForm({ ...form, mileage: e.target.value })} className="border rounded-xl px-4 py-2 w-full" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Transmission</label>
                  <select value={form.transmission} onChange={(e) => setForm({ ...form, transmission: e.target.value })} className="border rounded-xl px-4 py-2 w-full">
                    <option value="Automatic">Automatic</option>
                    <option value="Manual">Manual</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Fuel Type</label>
                  <select value={form.fuel_type} onChange={(e) => setForm({ ...form, fuel_type: e.target.value })} className="border rounded-xl px-4 py-2 w-full">
                    <option value="Gasoline">Gasoline</option>
                    <option value="Hybrid">Hybrid</option>
                    <option value="Electric">Electric</option>
                    <option value="Diesel">Diesel</option>
                  </select>
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Bedrooms</label>
                  <input type="number" placeholder="3" value={form.beds} onChange={(e) => setForm({ ...form, beds: e.target.value })} className="border rounded-xl px-4 py-2 w-full" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Bathrooms</label>
                  <input type="number" step="0.5" placeholder="2.5" value={form.baths} onChange={(e) => setForm({ ...form, baths: e.target.value })} className="border rounded-xl px-4 py-2 w-full" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Square Footage (Sq Ft)</label>
                  <input type="number" placeholder="2000" value={form.sqft} onChange={(e) => setForm({ ...form, sqft: e.target.value })} className="border rounded-xl px-4 py-2 w-full" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Garage Spaces</label>
                  <input type="number" placeholder="2" value={form.garages} onChange={(e) => setForm({ ...form, garages: e.target.value })} className="border rounded-xl px-4 py-2 w-full" />
                </div>
              </>
            )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Price ($)</label>
              <input type="number" placeholder="100000" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className="border rounded-xl px-4 py-2 w-full" required />
              <p className="text-xs text-gray-400 mt-1">Total price of the item.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Down Payment (%)</label>
              <input type="number" placeholder="20" value={form.down_payment_percent} onChange={(e) => setForm({ ...form, down_payment_percent: e.target.value })} className="border rounded-xl px-4 py-2 w-full" required />
              <p className="text-xs text-gray-400 mt-1">% required as initial down payment.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Monthly Payment ($)</label>
              <input type="number" placeholder="5000" value={form.monthly_payment} onChange={(e) => setForm({ ...form, monthly_payment: e.target.value })} className="border rounded-xl px-4 py-2 w-full" />
              <p className="text-xs text-gray-400 mt-1">Leave empty to auto-calculate based on Price, Down %, and Term.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Term (months)</label>
              <input type="number" placeholder="12" value={form.term_months} onChange={(e) => setForm({ ...form, term_months: e.target.value })} className="border rounded-xl px-4 py-2 w-full" required />
              <p className="text-xs text-gray-400 mt-1">Payment term in months.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Likes Count</label>
              <input type="number" placeholder="78000" value={form.interested_count} onChange={(e) => setForm({ ...form, interested_count: e.target.value })} className="border rounded-xl px-4 py-2 w-full" />
              <p className="text-xs text-gray-400 mt-1">Number of likes (e.g. 78000 will be shown as 78k).</p>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700">Original Listing URL</label>
              <input type="url" placeholder="https://www.westerlycolorado.com/available-homes/..." value={form.property_url} onChange={(e) => setForm({ ...form, property_url: e.target.value })} className="border rounded-xl px-4 py-2 w-full" />
              <p className="text-xs text-gray-400 mt-1">Link to the source listing page (Westerly, Edmunds, Zillow, etc.) so users can view full details.</p>
            </div>

            {/* Images — one URL per input box */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700">Images</label>
              {form.category === 'Car' && (
                <p className="text-[11px] text-amber-600 bg-amber-50 border border-amber-100 rounded-lg p-2 mt-1">
                  <strong>TIP:</strong> Vehicles should only have <strong>1 high-quality photo</strong> representing that exact model. Mismatched car images must not be added.
                </p>
              )}
              <div className="space-y-2 mt-1">
                {images.map((url, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      type="url"
                      placeholder="https://example.com/image.jpg"
                      value={url}
                      onChange={(e) => updateImage(i, e.target.value)}
                      className="border rounded-xl px-4 py-2 w-full"
                    />
                    <button
                      type="button"
                      onClick={() => removeImage(i)}
                      className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition shrink-0"
                      aria-label="Remove image"
                    >
                      <X size={18} />
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={addImage}
                className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-brand hover:underline"
              >
                <Plus size={15} /> Add another image
              </button>
              <p className="text-xs text-gray-400 mt-1">One image URL per box. Add multiple to enable the scrolling gallery on the user's page.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Status</label>
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="border rounded-xl px-4 py-2 w-full">
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
              <p className="text-xs text-gray-400 mt-1">Active listings appear on the user page.</p>
            </div>
            <div className="md:col-span-2 space-y-2">
              <div className="flex flex-wrap gap-2">
                <button type="submit" className="bg-brand text-white px-6 py-2 rounded-xl">Save Listing</button>
                <button type="button" onClick={() => { setShowForm(false); resetForm(); }} className="bg-gray-200 px-6 py-2 rounded-xl">Cancel</button>
              </div>
              <p className="text-xs text-gray-400 font-medium">Saves the listing. Active listings are instantly viewable on the user portfolio platform.</p>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead className="bg-gray-50">
            <tr>
              <th className="p-4 text-left">Category</th>
              <th className="p-4 text-left">Title</th>
              <th className="p-4 text-left">Location</th>
              <th className="p-4 text-left">Specs</th>
              <th className="p-4 text-left">Price</th>
              <th className="p-4 text-left">Down %</th>
              <th className="p-4 text-left">Term</th>
              <th className="p-4 text-left">Status</th>
              <th className="p-4 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {properties.map((p) => (
              <tr key={p.id} className="border-t">
                <td className="p-4"><span className="px-2 py-1 rounded-full text-xs bg-brand/10 text-brand font-medium">{p.category || 'Property'}</span></td>
                <td className="p-4">
                  <div className="flex items-center gap-3">
                    {p.image_urls && p.image_urls.length > 0 ? (
                      <img src={p.image_urls[0]} alt={p.title} className="w-10 h-10 object-cover rounded-lg border border-gray-100 shrink-0" />
                    ) : (
                      <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center border border-gray-100 shrink-0">
                        <Building2 size={16} className="text-gray-400" />
                      </div>
                    )}
                    <span className="font-medium text-gray-900">{p.title}</span>
                  </div>
                </td>
                <td className="p-4">{p.location || '—'}</td>
                <td className="p-4 text-xs text-gray-500 whitespace-nowrap">
                  {p.category === 'Car' 
                    ? `${p.year || 2020} ${p.make || ''} / ${(p.mileage || 0).toLocaleString()} mi / ${p.transmission || 'Auto'} / ${p.fuel_type || 'Gas'}`
                    : `${p.beds || 3}bd / ${p.baths || 2.5}ba / ${(p.sqft || 2000).toLocaleString()}sqft / ${p.garages || 2}car`
                  }
                </td>
                <td className="p-4">${p.price.toLocaleString()}</td>
                <td className="p-4">{p.down_payment_percent}%</td>
                <td className="p-4">{p.term_months}m</td>
                <td className="p-4">
                  <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                    p.status === 'active' 
                      ? 'bg-green-100 text-green-700' 
                      : p.status === 'sold'
                      ? 'bg-red-100 text-red-700'
                      : 'bg-gray-100 text-gray-700'
                  }`}>
                    {p.status}
                  </span>
                </td>
                <td className="p-4 space-x-3 whitespace-nowrap">
                  <button onClick={() => openEdit(p)} className="text-blue-500 hover:text-blue-600 inline-block align-middle" title="Edit"><Edit size={18} /></button>
                  {p.status === 'sold' ? (
                    <button
                      onClick={() => toggleStatus(p.id, 'active')}
                      className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-lg text-xs font-bold transition inline-block align-middle"
                    >
                      Make Active
                    </button>
                  ) : (
                    <button
                      onClick={() => toggleStatus(p.id, 'sold')}
                      className="text-amber-600 hover:text-amber-700 hover:bg-amber-50 border border-amber-200 px-2 py-1 rounded-lg text-xs font-bold transition inline-block align-middle"
                    >
                      Mark Sold
                    </button>
                  )}
                  <button onClick={() => handleDelete(p.id)} className="text-red-500 hover:text-red-600 inline-block align-middle" title="Delete"><Trash size={18} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {properties.length === 0 && <p className="p-8 text-gray-500 text-center">No listings.</p>}
      </div>
    </div>
  );
}
