import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
import AuthModal from "@/components/auth/auth-modal";

interface NavigationProps {
  onCreateEvent: () => void;
  onOpenBookings: () => void;
  onOpenChat: () => void;
  onOpenRequests: () => void;
}

export default function Navigation({ onCreateEvent, onOpenBookings, onOpenChat, onOpenRequests }: NavigationProps) {
  const { user, signOut, isAuthenticated } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  
  // Fetch chat notifications count
  const { data: chats = [] } = useQuery({
    queryKey: ['/api/my-chats'],
    enabled: !!user,
  });
  
  // Fetch pending booking requests count for hosts
  const { data: pendingBookings = [] } = useQuery({
    queryKey: ['/api/pending-bookings'],
    enabled: !!user,
  });
  
  const unreadCount = Array.isArray(chats) ? chats.reduce((total: number, chat: any) => total + (chat.unreadCount || 0), 0) : 0;
  const pendingRequestsCount = Array.isArray(pendingBookings) ? pendingBookings.length : 0;

  const handleLogout = async () => {
    const { error } = await signOut();
    if (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <nav className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-50">
      <div className="w-full px-16">
        <div className="flex items-center justify-between h-16 w-full">
          {/* Left: Logo */}
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-everest-blue rounded-lg flex items-center justify-center">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-gray-900">Everest</span>
          </div>

          {/* Right: Navigation Links + User Avatar */}
          <div className="flex items-center space-x-6">
            {isAuthenticated ? (
              <>
                {/* Desktop Navigation Links */}
                <div className="hidden md:flex items-center space-x-6">
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
                      {unreadCount > 0 && (
                        <Badge variant="destructive" className="ml-1 w-5 h-5 p-0 flex items-center justify-center text-xs">
                          {unreadCount}
                        </Badge>
                      )}
                    </div>
                  </button>
                  <button 
                    onClick={onOpenRequests}
                    className="text-gray-600 hover:text-gray-900 relative font-medium"
                  >
                    <div className="flex items-center space-x-1">
                      <Calendar className="w-4 h-4" />
                      <span>Requests</span>
                      {pendingRequestsCount > 0 && (
                        <Badge variant="destructive" className="ml-1 w-5 h-5 p-0 flex items-center justify-center text-xs">
                          {pendingRequestsCount}
                        </Badge>
                      )}
                    </div>
                  </button>
                </div>

                {/* User Avatar */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={user?.user_metadata?.avatar || undefined} alt="Profile" />
                        <AvatarFallback>
                          {user?.user_metadata?.firstName?.[0] || user?.email?.[0] || 'U'}
                        </AvatarFallback>
                      </Avatar>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" forceMount>
                    <div className="flex flex-col space-y-1 p-2">
                      <p className="text-sm font-medium leading-none">
                        {user?.user_metadata?.firstName && user?.user_metadata?.lastName 
                          ? `${user.user_metadata.firstName} ${user.user_metadata.lastName}`
                          : user?.user_metadata?.name || user?.email
                        }
                      </p>
                      <p className="text-xs leading-none text-muted-foreground">
                        {user?.email}
                      </p>
                    </div>
                    <DropdownMenuItem onClick={handleLogout}>
                      <span>Log out</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : (
              /* Login Button for Unauthenticated Users */
              <Button 
                onClick={() => setShowAuthModal(true)}
                className="bg-everest-blue hover:bg-blue-700"
              >
                Login
              </Button>
            )}
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden flex items-center ml-auto">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2"
            >
              <Menu className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && isAuthenticated && (
          <div className="md:hidden border-t border-gray-200 pb-3 pt-4">
            <div className="space-y-3">
              <button 
                onClick={() => {
                  onOpenBookings();
                  setIsMobileMenuOpen(false);
                }}
                className="block w-full text-left px-3 py-2 text-gray-600 hover:text-gray-900 font-medium"
              >
                My Bookings
              </button>
              <button 
                onClick={() => {
                  onOpenChat();
                  setIsMobileMenuOpen(false);
                }}
                className="block w-full text-left px-3 py-2 text-gray-600 hover:text-gray-900 font-medium"
              >
                <div className="flex items-center space-x-2">
                  <MessageCircle className="w-4 h-4" />
                  <span>Chat</span>
                  {unreadCount > 0 && (
                    <Badge variant="destructive" className="ml-2 w-5 h-5 p-0 flex items-center justify-center text-xs">
                      {unreadCount}
                    </Badge>
                  )}
                </div>
              </button>
              <button 
                onClick={() => {
                  onOpenRequests();
                  setIsMobileMenuOpen(false);
                }}
                className="block w-full text-left px-3 py-2 text-gray-600 hover:text-gray-900 font-medium"
              >
                <div className="flex items-center space-x-2">
                  <Calendar className="w-4 h-4" />
                  <span>Requests</span>
                  {pendingRequestsCount > 0 && (
                    <Badge variant="destructive" className="ml-2 w-5 h-5 p-0 flex items-center justify-center text-xs">
                      {pendingRequestsCount}
                    </Badge>
                  )}
                </div>
              </button>
              <div className="border-t border-gray-200 pt-3">
                <div className="flex items-center px-3 py-2">
                  <Avatar className="h-8 w-8 mr-3">
                    <AvatarImage src={user?.user_metadata?.avatar || undefined} />
                    <AvatarFallback>
                      {user?.user_metadata?.firstName?.[0] || user?.email?.[0] || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">
                      {user?.user_metadata?.firstName && user?.user_metadata?.lastName 
                        ? `${user.user_metadata.firstName} ${user.user_metadata.lastName}`
                        : user?.user_metadata?.name || user?.email?.split('@')[0]
                      }
                    </p>
                  </div>
                </div>
                <button 
                  onClick={handleLogout}
                  className="block w-full text-left px-3 py-2 text-gray-600 hover:text-gray-900 font-medium"
                >
                  Log out
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Auth Modal */}
      <AuthModal 
        isOpen={showAuthModal} 
        onClose={() => setShowAuthModal(false)} 
      />
    </nav>
  );
}