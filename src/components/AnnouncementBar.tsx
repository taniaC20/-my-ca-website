import { useState } from "react";
import { Megaphone, X, Tag, Info } from "lucide-react";
import { Announcement } from "../types";

interface AnnouncementBarProps {
  announcements: Announcement[];
}

export default function AnnouncementBar({ announcements }: AnnouncementBarProps) {
  const activeAnnouncements = announcements.filter((a) => a.active);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [closed, setClosed] = useState(false);

  if (activeAnnouncements.length === 0 || closed) return null;

  const current = activeAnnouncements[currentIndex];

  const nextAnnouncement = () => {
    setCurrentIndex((prev) => (prev + 1) % activeAnnouncements.length);
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "promo":
        return <Tag className="h-4 w-4 text-[#D4AF37]" />;
      case "urgent":
        return <Megaphone className="h-4 w-4 text-brand-muted animate-bounce" />;
      default:
        return <Info className="h-4 w-4 text-brand-primary" />;
    }
  };

  const getBgClass = (type: string) => {
    switch (type) {
      case "urgent":
        return "bg-brand-dark text-white border-b border-brand-border/10";
      case "promo":
        return "bg-brand-primary text-white border-b border-brand-border/10";
      default:
        return "bg-brand-highlight text-brand-text border-b border-brand-border";
    }
  };

  return (
    <div id="announcement-banner" className={`relative py-2.5 px-8 text-center text-xs md:text-sm font-sans flex items-center justify-center transition-all ${getBgClass(current.type)}`}>
      <div className="flex items-center gap-2 max-w-4xl mx-auto px-4">
        {getIcon(current.type)}
        <span className="font-semibold tracking-wide uppercase text-[10px] bg-white/10 px-1.5 py-0.5 rounded-sm">
          {current.type === "promo" ? "Offer" : current.type === "urgent" ? "Notice" : "News"}
        </span>
        <span className="font-medium inline-block">{current.title}:</span>
        <span className="opacity-90">{current.content}</span>
        {activeAnnouncements.length > 1 && (
          <button
            id="next-announcement-btn"
            onClick={nextAnnouncement}
            className="ml-2 underline hover:opacity-75 cursor-pointer font-semibold text-[11px]"
          >
            Next
          </button>
        )}
      </div>
      <button
        id="close-announcement-btn"
        onClick={() => setClosed(true)}
        className={`absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full cursor-pointer transition-colors ${
          current.type === "info" ? "text-brand-text/60 hover:text-brand-text" : "text-white/60 hover:text-white"
        }`}
        aria-label="Close Announcement"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
