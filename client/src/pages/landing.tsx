import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Activity, Users, MapPin, MessageCircle, Shield, Star } from "lucide-react";

export default function Landing() {
  const handleLogin = () => {
    window.location.href = "/api/login";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-everest-blue rounded-lg flex items-center justify-center">
                <Activity className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold text-gray-900">Everest</span>
            </div>
            <Button onClick={handleLogin} className="bg-everest-blue hover:bg-blue-700">
              Log In
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-5xl font-bold text-gray-900 mb-6">
            Find Your Next <span className="text-everest-blue">Sports Adventure</span>
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            Join local sports events, meet fellow athletes, and stay active with Everest. 
            From badminton to basketball, discover games happening near you.
          </p>
          <Button 
            onClick={handleLogin} 
            size="lg" 
            className="bg-everest-blue hover:bg-blue-700 text-lg px-8 py-4"
          >
            Get Started
          </Button>
        </div>
      </section>

      {/* Sports Grid */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
            Six Sports, Endless Possibilities
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
            <Card className="text-center hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="w-12 h-12 bg-sport-badminton rounded-full flex items-center justify-center mx-auto mb-4">
                  <Activity className="w-6 h-6 text-white" />
                </div>
                <h3 className="font-semibold text-gray-900">Badminton</h3>
                <p className="text-sm text-gray-600 mt-2">Singles & doubles matches</p>
              </CardContent>
            </Card>
            
            <Card className="text-center hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="w-12 h-12 bg-sport-basketball rounded-full flex items-center justify-center mx-auto mb-4">
                  <Activity className="w-6 h-6 text-white" />
                </div>
                <h3 className="font-semibold text-gray-900">Basketball</h3>
                <p className="text-sm text-gray-600 mt-2">3×3 & 5×5 games</p>
              </CardContent>
            </Card>
            
            <Card className="text-center hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="w-12 h-12 bg-sport-soccer rounded-full flex items-center justify-center mx-auto mb-4">
                  <Activity className="w-6 h-6 text-white" />
                </div>
                <h3 className="font-semibold text-gray-900">Soccer</h3>
                <p className="text-sm text-gray-600 mt-2">5, 7 & 11-a-side matches</p>
              </CardContent>
            </Card>
            
            <Card className="text-center hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="w-12 h-12 bg-sport-tennis rounded-full flex items-center justify-center mx-auto mb-4">
                  <Activity className="w-6 h-6 text-white" />
                </div>
                <h3 className="font-semibold text-gray-900">Tennis</h3>
                <p className="text-sm text-gray-600 mt-2">Singles & doubles play</p>
              </CardContent>
            </Card>
            
            <Card className="text-center hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="w-12 h-12 bg-sport-volleyball rounded-full flex items-center justify-center mx-auto mb-4">
                  <Activity className="w-6 h-6 text-white" />
                </div>
                <h3 className="font-semibold text-gray-900">Volleyball</h3>
                <p className="text-sm text-gray-600 mt-2">Indoor & beach volleyball</p>
              </CardContent>
            </Card>
            
            <Card className="text-center hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="w-12 h-12 bg-sport-tabletennis rounded-full flex items-center justify-center mx-auto mb-4">
                  <Activity className="w-6 h-6 text-white" />
                </div>
                <h3 className="font-semibold text-gray-900">Table Tennis</h3>
                <p className="text-sm text-gray-600 mt-2">Singles, doubles & tournaments</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
            Why Choose Everest?
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-everest-blue rounded-full flex items-center justify-center mx-auto mb-4">
                <MapPin className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Location-Based Discovery</h3>
              <p className="text-gray-600">Find games happening near you with our smart location filtering and interactive map view.</p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-everest-green rounded-full flex items-center justify-center mx-auto mb-4">
                <MessageCircle className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Real-Time Chat</h3>
              <p className="text-gray-600">Coordinate with fellow players through our built-in messaging system for each event.</p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-everest-orange rounded-full flex items-center justify-center mx-auto mb-4">
                <Shield className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Secure Payments</h3>
              <p className="text-gray-600">Safe escrow payments that protect both hosts and participants with automatic refunds.</p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-sport-tennis rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Skill-Based Matching</h3>
              <p className="text-gray-600">Find players at your skill level with our comprehensive filtering and rating system.</p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-sport-volleyball rounded-full flex items-center justify-center mx-auto mb-4">
                <Star className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Review System</h3>
              <p className="text-gray-600">Build your reputation and find trustworthy players through our review and rating system.</p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-sport-badminton rounded-full flex items-center justify-center mx-auto mb-4">
                <Activity className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Sport-Specific Features</h3>
              <p className="text-gray-600">Detailed configuration options tailored to each sport's unique requirements and rules.</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-everest-blue">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Ready to Join the Community?
          </h2>
          <p className="text-xl text-blue-100 mb-8">
            Start discovering local sports events and connect with athletes in your area.
          </p>
          <Button 
            onClick={handleLogin}
            size="lg" 
            variant="secondary" 
            className="bg-white text-everest-blue hover:bg-gray-100 text-lg px-8 py-4"
          >
            Join Everest Today
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="flex items-center justify-center space-x-3 mb-4">
            <div className="w-8 h-8 bg-everest-blue rounded-lg flex items-center justify-center">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold">Everest</span>
          </div>
          <p className="text-gray-400">
            Connect. Play. Achieve.
          </p>
        </div>
      </footer>
    </div>
  );
}
