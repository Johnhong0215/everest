import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Activity, Plus, MessageCircle, Calendar, Menu } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

interface NavigationProps {
  onCreateEvent: () => void;
  onOpenBookings: () => void;
  onOpenChat: () => void;
}

export default function Navigation({ onCreateEvent, onOpenBookings, onOpenChat }: NavigationProps) {
  const { user } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    window.location.href = "/api/logout";
  };

  return (
    <nav className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-everest-blue rounded-lg flex items-center justify-center">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-gray-900">Everest</span>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-8">
            <button 
              onClick={onOpenBookings}
              className="text-gray-600 hover:text-gray-900 font-medium"
            >
              My Bookings
            </button>
            <button 
              onClick={onOpenChat}
              className="text-gray-600 hover:text-gray-900 relative font-medium"
            >
              <div className="flex items-center space-x-1">
                <MessageCircle className="w-4 h-4" />
                <span>Chat</span>
              </div>
              <Badge variant="destructive" className="absolute -top-2 -right-2 w-5 h-5 p-0 flex items-center justify-center text-xs">
                3
              </Badge>
            </button>
            <Button 
              onClick={onCreateEvent}
              className="bg-everest-blue hover:bg-blue-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Event
            </Button>
          </div>

          {/* User Menu */}
          <div className="flex items-center space-x-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={user?.profileImageUrl || undefined} alt="Profile" />
                    <AvatarFallback>
                      {user?.firstName?.[0] || user?.email?.[0] || 'U'}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" forceMount>
                <div className="flex flex-col space-y-1 p-2">
                  <p className="text-sm font-medium leading-none">
                    {user?.firstName && user?.lastName 
                      ? `${user.firstName} ${user.lastName}`
                      : user?.email
                    }
                  </p>
                  <p className="text-xs leading-none text-muted-foreground">
                    {user?.email}
                  </p>
                </div>
                <DropdownMenuItem onClick={onOpenBookings}>
                  <Calendar className="mr-2 h-4 w-4" />
                  <span>My Bookings</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onOpenChat}>
                  <MessageCircle className="mr-2 h-4 w-4" />
                  <span>Messages</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleLogout}>
                  <span>Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            
            <Button 
              variant="ghost" 
              size="sm"
              className="md:hidden"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              <Menu className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden py-4 space-y-2 border-t border-gray-200">
            <Button 
              variant="ghost" 
              className="w-full justify-start"
              onClick={() => {
                onOpenBookings();
                setIsMobileMenuOpen(false);
              }}
            >
              <Calendar className="w-4 h-4 mr-2" />
              My Bookings
            </Button>
            <Button 
              variant="ghost" 
              className="w-full justify-start"
              onClick={() => {
                onOpenChat();
                setIsMobileMenuOpen(false);
              }}
            >
              <MessageCircle className="w-4 h-4 mr-2" />
              Chat
              <Badge variant="destructive" className="ml-auto">3</Badge>
            </Button>
            <Button 
              onClick={() => {
                onCreateEvent();
                setIsMobileMenuOpen(false);
              }}
              className="w-full bg-everest-blue hover:bg-blue-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Event
            </Button>
          </div>
        )}
      </div>
    </nav>
  );
}
