import React, { useState } from "react";
import { Star, MessageSquareCode, CheckCircle } from "lucide-react";
import { Testimonial } from "../types";

interface TestimonialSectionProps {
  testimonials: Testimonial[];
  onSubmitTestimonial: (t: Omit<Testimonial, "id" | "date" | "approved">) => void;
}

export default function TestimonialSection({ testimonials, onSubmitTestimonial }: TestimonialSectionProps) {
  const approvedTestimonials = testimonials.filter((t) => t.approved);

  const [formData, setFormData] = useState({
    author: "",
    company: "",
    rating: 5,
    content: "",
  });

  const [showForm, setShowForm] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  const avgRating = approvedTestimonials.length
    ? (approvedTestimonials.reduce((sum, t) => sum + t.rating, 0) / approvedTestimonials.length).toFixed(1)
    : "0.0";

  const handleRatingClick = (r: number) => {
    setFormData((prev) => ({ ...prev, rating: r }));
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => {
        const copy = { ...prev };
        delete copy[name];
        return copy;
      });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: { [key: string]: string } = {};
    if (!formData.author.trim()) newErrors.author = "Name is required.";
    if (!formData.content.trim()) newErrors.content = "Review content is required.";

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    onSubmitTestimonial({
      author: formData.author,
      company: formData.company || undefined,
      rating: formData.rating,
      content: formData.content,
    });

    setSuccess(true);
    setFormData({
      author: "",
      company: "",
      rating: 5,
      content: "",
    });

    setTimeout(() => {
      setSuccess(false);
      setShowForm(false);
    }, 6000);
  };

  return (
    <div id="testimonial-section-container" className="space-y-12">
      {/* Testimonials Summary stats */}
      <div className="bg-brand-highlight border border-brand-border rounded-[24px] p-6 flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-3">
          <span className="text-brand-dark font-serif font-bold text-2xl md:text-3xl leading-none">{avgRating}</span>
          <div className="flex flex-col">
            <div className="flex text-brand-primary mb-0.5">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  className={`h-4 w-4 ${star <= Math.round(Number(avgRating)) ? "fill-brand-primary stroke-brand-primary" : "text-brand-border"}`}
                />
              ))}
            </div>
            <span className="text-[10px] text-brand-muted uppercase tracking-wider font-semibold">Verified Reviews</span>
          </div>
        </div>

        <button
          id="toggle-testimonial-form-btn"
          onClick={() => setShowForm(!showForm)}
          className="text-[10px] uppercase tracking-widest font-bold bg-brand-primary hover:bg-brand-primary-hover text-white px-5 py-2.5 rounded-full cursor-pointer transition-colors shrink-0"
        >
          {showForm ? "Close Review Panel" : "Submit a Testimonial"}
        </button>
      </div>

      {/* Testimonial Submission Form Panel */}
      {showForm && (
        <div id="new-testimonial-form" className="bg-brand-highlight border border-brand-border rounded-[24px] p-6 max-w-2xl mx-auto animate-fade-in space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <MessageSquareCode className="h-5 w-5 text-brand-primary" />
            <h4 className="font-serif font-bold text-brand-dark text-lg">Leave an Honest Testimonial</h4>
          </div>

          {success ? (
            <div id="testimonial-success-banner" className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-950 rounded-[12px] text-xs flex flex-col gap-1">
              <span className="font-bold flex items-center gap-1.5 text-emerald-800">
                <CheckCircle className="h-4 w-4 text-emerald-700" /> Review Submitted Successfully!
              </span>
              <p>Thank you for sharing your feedback! To maintain high standards, all testimonials are reviewed by our administration before being featured on our live landing board.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label htmlFor="testimonial-author" className="text-[10px] font-bold text-brand-muted uppercase tracking-wider">Your Name <span className="text-red-500">*</span></label>
                  <input
                    id="testimonial-author"
                    name="author"
                    type="text"
                    value={formData.author}
                    onChange={handleInputChange}
                    placeholder="Marcus Aurelius"
                    className={`bg-white border rounded-[8px] py-1.5 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-brand-primary ${errors.author ? "border-red-500" : "border-brand-border"}`}
                  />
                  {errors.author && <span className="text-[10px] text-red-600">{errors.author}</span>}
                </div>

                <div className="flex flex-col gap-1">
                  <label htmlFor="testimonial-company" className="text-[10px] font-bold text-brand-muted uppercase tracking-wider">Company/Affiliation (Optional)</label>
                  <input
                    id="testimonial-company"
                    name="company"
                    type="text"
                    value={formData.company}
                    onChange={handleInputChange}
                    placeholder="Rome Imports"
                    className="bg-white border border-brand-border rounded-[8px] py-1.5 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-brand-primary"
                  />
                </div>
              </div>

              {/* Interactive Star Selection */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-brand-muted uppercase tracking-wider">Craft Rating</label>
                <div className="flex gap-1 py-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => handleRatingClick(star)}
                      className="text-2xl cursor-pointer focus:outline-none transition-transform hover:scale-110"
                      aria-label={`Rate ${star} Stars`}
                    >
                      <Star
                        className={`h-6 w-6 ${star <= formData.rating ? "fill-brand-primary text-brand-primary" : "text-brand-border"}`}
                      />
                    </button>
                  ))}
                </div>
              </div>

              {/* Review Content */}
              <div className="flex flex-col gap-1">
                <label htmlFor="testimonial-content" className="text-[10px] font-bold text-brand-muted uppercase tracking-wider">Your Message <span className="text-red-500">*</span></label>
                <textarea
                  id="testimonial-content"
                  name="content"
                  rows={3}
                  value={formData.content}
                  onChange={handleInputChange}
                  placeholder="Share details of your experience with our woodwork, glassware, or custom engraving services..."
                  className={`bg-white border rounded-[8px] py-1.5 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-brand-primary ${errors.content ? "border-red-500" : "border-brand-border"}`}
                />
                {errors.content && <span className="text-[10px] text-red-600">{errors.content}</span>}
              </div>

              <button
                id="testimonial-submit-btn"
                type="submit"
                className="w-full bg-brand-primary hover:bg-brand-primary-hover text-white font-sans font-bold py-2.5 px-4 rounded-full transition-colors text-[10px] uppercase tracking-widest cursor-pointer"
              >
                Submit for Admin Verification
              </button>
            </form>
          )}
        </div>
      )}

      {/* Grid of Testimonials */}
      {approvedTestimonials.length === 0 ? (
        <div className="bg-white border border-dashed border-brand-border rounded-[24px] p-10 text-center max-w-lg mx-auto">
          <p className="text-brand-dark font-serif font-bold text-base mb-1">No Published Testimonials Yet</p>
          <p className="text-brand-muted text-xs font-light">Have you received a custom gift or keepsake from Nicoletta? Click &quot;Write a Review&quot; above to submit your review!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {approvedTestimonials.map((t) => (
            <div
              key={t.id}
              id={`testimonial-card-${t.id}`}
              className="bg-white border border-brand-border rounded-[24px] p-6 shadow-xs flex flex-col justify-between"
            >
              <div>
                {/* Stars */}
                <div className="flex text-brand-primary mb-3">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={`h-3.5 w-3.5 ${star <= t.rating ? "fill-brand-primary text-brand-primary" : "text-brand-border"}`}
                    />
                  ))}
                </div>
                <p className="text-brand-muted text-xs md:text-sm italic leading-relaxed mb-4">
                  &ldquo;{t.content}&rdquo;
                </p>
              </div>

              <div className="pt-3 border-t border-brand-border flex items-center justify-between">
                <div>
                  <span className="font-sans font-bold text-brand-dark text-xs block">{t.author}</span>
                  {t.company && (
                    <span className="text-[10px] text-brand-muted font-semibold block">{t.company}</span>
                  )}
                </div>
                <span className="text-[9px] text-brand-muted font-medium font-mono">{t.date}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
