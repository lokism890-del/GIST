// app/lib/db.ts
export const db = {
  user: {
    findUnique: async (args: any) => {
      // MOCK: Simulating a user who has an active Pro subscription
      return { polarSubscriptionStatus: 'active' }; 
    }
  },
  voiceNote: {
    count: async (args: any) => {
      // MOCK: Simulating a user who has used the app 2 times this month
      return 2; 
    }
  }
};