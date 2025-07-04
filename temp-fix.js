// Quick fix for the broken getPendingBookingsForHost function
async function getPendingBookingsForHost(hostId) {
  try {
    // Get events where user is host
    const { data: events, error } = await supabase
      .from('events')
      .select('*')
      .eq('host_id', hostId);

    if (error) throw new Error(`Pending bookings fetch failed: ${error.message}`);
    if (!events) return [];

    console.log(`Found ${events.length} events for host ${hostId}`);

    const pendingBookings = [];

    // Fetch host details once
    const { data: host, error: hostError } = await supabase
      .from('users')
      .select('*')
      .eq('id', hostId)
      .single();

    for (const event of events) {
      if (event.requested_users && event.requested_users.length > 0) {
        console.log(`Processing event ${event.id} with ${event.requested_users.length} requested users`);
        
        for (const userId of event.requested_users) {
          // Fetch user details
          const { data: userData, error: userError } = await supabase
            .from('users')
            .select('*')
            .eq('id', userId)
            .single();

          let user = userData;
          if (userError) {
            console.log(`Error fetching user ${userId}:`, userError);
            // Create fallback user
            user = {
              id: userId,
              email: 'unknown@example.com',
              first_name: 'Unknown',
              last_name: 'User',
              display_name: 'Unknown User'
            };
          }

          if (user) {
            pendingBookings.push({
              id: event.id,
              eventId: event.id,
              userId: userId,
              status: 'requested',
              event: event,
              user: user
            });
          }
        }
      }
    }

    return pendingBookings;
  } catch (error) {
    console.error('Error fetching pending bookings:', error);
    return [];
  }
}