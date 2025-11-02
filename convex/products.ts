import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("products").collect();
  },
});

export const listByCategory = query({
  args: { categoryId: v.id("categories") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("products")
      .withIndex("by_category", (q) => q.eq("categoryId", args.categoryId))
      .collect();
  },
});

export const getCategories = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("categories").collect();
  },
});

export const addUtensils = mutation({
  args: {},
  handler: async (ctx) => {
    const pantryCategory = await ctx.db
      .query("categories")
      .filter((q) => q.eq(q.field("name"), "Pantry Staples"))
      .first();
    
    if (!pantryCategory) {
      throw new Error("Pantry Staples category not found");
    }

    await ctx.db.insert("products", {
      name: "Stainless Steel Spoons",
      description: "Set of 6 tablespoons",
      price: 8.99,
      image: "🥄",
      unit: "set",
      inStock: true,
      categoryId: pantryCategory._id,
    });

    await ctx.db.insert("products", {
      name: "Kitchen Knives Set",
      description: "3-piece knife set with holder",
      price: 24.99,
      image: "🔪",
      unit: "set",
      inStock: true,
      categoryId: pantryCategory._id,
    });

    return "Utensils added!";
  },
});

export const addSoapAndFaceWash = mutation({
  args: {},
  handler: async (ctx) => {
    // Find Personal Care category
    const personalCareCategory = await ctx.db
      .query("categories")
      .filter((q) => q.eq(q.field("name"), "Personal Care"))
      .first();
    
    if (!personalCareCategory) {
      throw new Error("Personal Care category not found");
    }

    // Add soap and face wash
    await ctx.db.insert("products", {
      name: "Dove Soap",
      description: "Moisturizing beauty bar",
      price: 1.99,
      image: "🧼",
      unit: "piece",
      inStock: true,
      categoryId: personalCareCategory._id,
    });

    await ctx.db.insert("products", {
      name: "Nivea Face Wash",
      description: "Deep cleansing face wash",
      price: 4.99,
      image: "🧴",
      unit: "piece",
      inStock: true,
      categoryId: personalCareCategory._id,
    });

    return "Soap and face wash added!";
  },
});

export const addPersonalCareProducts = mutation({
  args: {},
  handler: async (ctx) => {
    // Check if Personal Care category already exists
    const existingPersonalCare = await ctx.db
      .query("categories")
      .filter((q) => q.eq(q.field("name"), "Personal Care"))
      .first();
    
    if (existingPersonalCare) {
      return "Personal Care category already exists";
    }

    // Create Personal Care category
    const personalCareCategory = await ctx.db.insert("categories", {
      name: "Personal Care",
      image: "🧴",
      description: "Soaps, shampoos, toothpaste, and hygiene products"
    });

    return personalCareCategory;
  },
});

// Seed data function to populate initial products and categories
export const seedData = mutation({
  args: {},
  handler: async (ctx) => {
    // Check if data already exists
    const existingCategories = await ctx.db.query("categories").collect();
    if (existingCategories.length > 0) {
      return "Data already exists";
    }

    // Create categories
    const groceryCategory = await ctx.db.insert("categories", {
      name: "Groceries",
      image: "🥬",
      description: "Fresh fruits, vegetables, and daily essentials"
    });

    const personalCareCategory = await ctx.db.insert("categories", {
      name: "Personal Care",
      image: "🧴",
      description: "Soaps, shampoos, toothpaste, and hygiene products"
    });

    const householdCategory = await ctx.db.insert("categories", {
      name: "Household Items",
      image: "🧽",
      description: "Cleaning supplies, utensils, and home essentials"
    });

    const stationeryCategory = await ctx.db.insert("categories", {
      name: "Stationery",
      image: "📝",
      description: "Notebooks, pens, and office supplies"
    });

    const kitchenwareCategory = await ctx.db.insert("categories", {
      name: "Kitchenware",
      image: "🍴",
      description: "Utensils, cookware, and kitchen accessories"
    });

    const fruitsCategory = await ctx.db.insert("categories", {
      name: "Fresh Fruits",
      image: "🍎",
      description: "Fresh seasonal fruits and berries"
    });

    const cakesCategory = await ctx.db.insert("categories", {
      name: "Cakes & Desserts",
      image: "🎂",
      description: "Fresh cakes, pastries, and sweet treats"
    });

    // Grocery items
    const groceryItems = [
      { name: "Fresh Bananas", description: "Sweet and ripe bananas", price: 2.99, image: "🍌", unit: "kg", inStock: true },
      { name: "Red Apples", description: "Crisp and juicy red apples", price: 4.50, image: "🍎", unit: "kg", inStock: true },
      { name: "Whole Milk", description: "Fresh whole milk", price: 3.25, image: "🥛", unit: "liter", inStock: true },
      { name: "Brown Bread", description: "Whole wheat brown bread", price: 2.75, image: "🍞", unit: "piece", inStock: true },
      { name: "Farm Eggs", description: "Fresh farm eggs", price: 4.99, image: "🥚", unit: "dozen", inStock: true },
      { name: "Basmati Rice", description: "Premium basmati rice", price: 8.99, image: "🍚", unit: "kg", inStock: true },
      { name: "Chicken Breast", description: "Fresh chicken breast", price: 12.99, image: "🍗", unit: "kg", inStock: true },
      { name: "Tomatoes", description: "Fresh red tomatoes", price: 3.99, image: "🍅", unit: "kg", inStock: true },
      { name: "Onions", description: "Yellow cooking onions", price: 2.50, image: "🧅", unit: "kg", inStock: true },
      { name: "Potatoes", description: "Fresh potatoes", price: 2.99, image: "🥔", unit: "kg", inStock: true }
    ];

    // Personal care items
    const personalCareItems = [
      { name: "Dove Soap", description: "Moisturizing beauty bar", price: 1.99, image: "🧼", unit: "piece", inStock: true },
      { name: "Colgate Toothpaste", description: "Total advanced whitening", price: 3.49, image: "🦷", unit: "piece", inStock: true },
      { name: "Oral-B Toothbrush", description: "Medium bristle toothbrush", price: 2.99, image: "🪥", unit: "piece", inStock: true },
      { name: "Head & Shoulders Shampoo", description: "Anti-dandruff shampoo", price: 6.99, image: "🧴", unit: "piece", inStock: true },
      { name: "Nivea Face Wash", description: "Deep cleansing face wash", price: 4.99, image: "🧴", unit: "piece", inStock: true },
      { name: "Gillette Razor", description: "3-blade disposable razor", price: 8.99, image: "🪒", unit: "pack", inStock: true },
      { name: "Johnson's Baby Oil", description: "Gentle baby oil", price: 5.49, image: "🧴", unit: "piece", inStock: true },
      { name: "Listerine Mouthwash", description: "Cool mint mouthwash", price: 4.99, image: "🧴", unit: "piece", inStock: true },
      { name: "Vaseline Petroleum Jelly", description: "Original healing jelly", price: 3.99, image: "🧴", unit: "piece", inStock: true },
      { name: "Pantene Conditioner", description: "Pro-V daily moisture renewal", price: 6.49, image: "🧴", unit: "piece", inStock: true }
    ];

    // Household items
    const householdItems = [
      { name: "Surf Excel Detergent", description: "Matic front load washing powder", price: 12.99, image: "📦", unit: "kg", inStock: true },
      { name: "Vim Dishwash Liquid", description: "Lemon concentrated dishwash gel", price: 3.99, image: "🧴", unit: "piece", inStock: true },
      { name: "Harpic Toilet Cleaner", description: "Power plus toilet cleaner", price: 4.49, image: "🧴", unit: "piece", inStock: true },
      { name: "Colin Glass Cleaner", description: "Streak-free glass cleaner", price: 3.49, image: "🧴", unit: "piece", inStock: true },
      { name: "Scotch Brite Scrubber", description: "Heavy duty scrub pad", price: 1.99, image: "🧽", unit: "piece", inStock: true },
      { name: "Lizol Disinfectant", description: "Citrus floor cleaner", price: 5.99, image: "🧴", unit: "piece", inStock: true },
      { name: "Ariel Washing Powder", description: "Complete detergent powder", price: 11.99, image: "📦", unit: "kg", inStock: true },
      { name: "Comfort Fabric Softener", description: "Morning fresh fabric conditioner", price: 4.99, image: "🧴", unit: "piece", inStock: true },
      { name: "Mr. Clean All-Purpose", description: "Multi-surface cleaner", price: 3.99, image: "🧴", unit: "piece", inStock: true },
      { name: "Tide Pods", description: "Laundry detergent pods", price: 15.99, image: "📦", unit: "pack", inStock: true }
    ];

    // Stationery items
    const stationeryItems = [
      { name: "A4 Notebook", description: "200 pages ruled notebook", price: 2.99, image: "📓", unit: "piece", inStock: true },
      { name: "Ball Point Pens", description: "Blue ink pens pack of 10", price: 4.99, image: "🖊️", unit: "pack", inStock: true },
      { name: "Pencil Set", description: "HB pencils pack of 12", price: 3.49, image: "✏️", unit: "pack", inStock: true },
      { name: "Eraser", description: "White rubber eraser", price: 0.99, image: "🧽", unit: "piece", inStock: true },
      { name: "Ruler", description: "30cm plastic ruler", price: 1.49, image: "📏", unit: "piece", inStock: true },
      { name: "Highlighter Set", description: "Fluorescent markers pack of 4", price: 5.99, image: "🖍️", unit: "pack", inStock: true },
      { name: "Sticky Notes", description: "Yellow sticky notes pad", price: 2.49, image: "📝", unit: "piece", inStock: true },
      { name: "Stapler", description: "Desktop stapler with staples", price: 8.99, image: "📎", unit: "piece", inStock: true },
      { name: "Paper Clips", description: "Metal paper clips box", price: 1.99, image: "📎", unit: "box", inStock: true },
      { name: "Correction Tape", description: "White correction tape", price: 2.99, image: "🖊️", unit: "piece", inStock: true }
    ];

    // Kitchenware items
    const kitchenwareItems = [
      { name: "Stainless Steel Spoons", description: "Set of 6 tablespoons", price: 8.99, image: "🥄", unit: "set", inStock: true },
      { name: "Kitchen Knives Set", description: "3-piece knife set with holder", price: 24.99, image: "🔪", unit: "set", inStock: true },
      { name: "Plastic Plates", description: "Microwave safe plates set of 6", price: 12.99, image: "🍽️", unit: "set", inStock: true },
      { name: "Glass Tumblers", description: "Water glasses set of 6", price: 15.99, image: "🥤", unit: "set", inStock: true },
      { name: "Non-stick Frying Pan", description: "24cm non-stick frying pan", price: 19.99, image: "🍳", unit: "piece", inStock: true },
      { name: "Mixing Bowls", description: "Stainless steel bowls set of 3", price: 16.99, image: "🥣", unit: "set", inStock: true },
      { name: "Can Opener", description: "Manual can opener", price: 4.99, image: "🔧", unit: "piece", inStock: true },
      { name: "Cutting Board", description: "Bamboo cutting board", price: 12.99, image: "🔪", unit: "piece", inStock: true },
      { name: "Kitchen Towels", description: "Absorbent kitchen towels pack of 3", price: 6.99, image: "🧻", unit: "pack", inStock: true },
      { name: "Measuring Cups", description: "Plastic measuring cups set", price: 7.99, image: "🥤", unit: "set", inStock: true },
      { name: "Nail Cutters", description: "Stainless steel nail clippers", price: 3.99, image: "✂️", unit: "piece", inStock: true },
      { name: "Kitchen Scissors", description: "Multi-purpose kitchen scissors", price: 6.99, image: "✂️", unit: "piece", inStock: true }
    ];

    // Fresh fruits
    const fruitsItems = [
      { name: "Fresh Strawberries", description: "Sweet and juicy strawberries", price: 6.99, image: "🍓", unit: "kg", inStock: true },
      { name: "Ripe Mangoes", description: "Sweet Alphonso mangoes", price: 8.50, image: "🥭", unit: "kg", inStock: true },
      { name: "Fresh Oranges", description: "Juicy Valencia oranges", price: 4.99, image: "🍊", unit: "kg", inStock: true },
      { name: "Green Grapes", description: "Seedless green grapes", price: 7.99, image: "🍇", unit: "kg", inStock: true },
      { name: "Fresh Pineapple", description: "Sweet tropical pineapple", price: 5.99, image: "🍍", unit: "piece", inStock: true },
      { name: "Ripe Avocados", description: "Creamy Hass avocados", price: 12.99, image: "🥑", unit: "kg", inStock: true },
      { name: "Fresh Lemons", description: "Tangy fresh lemons", price: 3.99, image: "🍋", unit: "kg", inStock: true },
      { name: "Sweet Watermelon", description: "Juicy red watermelon", price: 2.99, image: "🍉", unit: "kg", inStock: true }
    ];

    // Cakes and desserts
    const cakesItems = [
      { name: "Chocolate Cake", description: "Rich chocolate layer cake", price: 24.99, image: "🍰", unit: "piece", inStock: true },
      { name: "Vanilla Birthday Cake", description: "Classic vanilla cake with frosting", price: 22.99, image: "🎂", unit: "piece", inStock: true },
      { name: "Red Velvet Cupcakes", description: "Set of 6 red velvet cupcakes", price: 12.99, image: "🧁", unit: "pack", inStock: true },
      { name: "Fresh Donuts", description: "Glazed donuts pack of 6", price: 8.99, image: "🍩", unit: "pack", inStock: true }
    ];

    // Insert all products
    for (const item of groceryItems) {
      await ctx.db.insert("products", {
        ...item,
        categoryId: groceryCategory,
      });
    }

    for (const item of personalCareItems) {
      await ctx.db.insert("products", {
        ...item,
        categoryId: personalCareCategory,
      });
    }

    for (const item of householdItems) {
      await ctx.db.insert("products", {
        ...item,
        categoryId: householdCategory,
      });
    }

    for (const item of stationeryItems) {
      await ctx.db.insert("products", {
        ...item,
        categoryId: stationeryCategory,
      });
    }

    for (const item of kitchenwareItems) {
      await ctx.db.insert("products", {
        ...item,
        categoryId: kitchenwareCategory,
      });
    }

    for (const item of fruitsItems) {
      await ctx.db.insert("products", {
        ...item,
        categoryId: fruitsCategory,
      });
    }

    for (const item of cakesItems) {
      await ctx.db.insert("products", {
        ...item,
        categoryId: cakesCategory,
      });
    }

    return "Seed data created successfully!";
  },
});

export const addFruitsAndCakes = mutation({
  args: {},
  handler: async (ctx) => {
    // Check if Fresh Fruits category already exists
    let fruitsCategory = await ctx.db
      .query("categories")
      .filter((q) => q.eq(q.field("name"), "Fresh Fruits"))
      .first();
    
    // Create Fresh Fruits category if it doesn't exist
    if (!fruitsCategory) {
      const fruitsId = await ctx.db.insert("categories", {
        name: "Fresh Fruits",
        image: "🍎",
        description: "Fresh seasonal fruits and berries"
      });
      fruitsCategory = await ctx.db.get(fruitsId);
    }

    // Check if Cakes & Desserts category already exists
    let cakesCategory = await ctx.db
      .query("categories")
      .filter((q) => q.eq(q.field("name"), "Cakes & Desserts"))
      .first();

    // Create Cakes & Desserts category if it doesn't exist
    if (!cakesCategory) {
      const cakesId = await ctx.db.insert("categories", {
        name: "Cakes & Desserts",
        image: "🎂",
        description: "Fresh cakes, pastries, and sweet treats"
      });
      cakesCategory = await ctx.db.get(cakesId);
    }

    // Add some fruits
    const fruitsItems = [
      { name: "Fresh Strawberries", description: "Sweet and juicy strawberries", price: 6.99, image: "🍓", unit: "kg", inStock: true },
      { name: "Ripe Mangoes", description: "Sweet Alphonso mangoes", price: 8.50, image: "🥭", unit: "kg", inStock: true },
      { name: "Fresh Oranges", description: "Juicy Valencia oranges", price: 4.99, image: "🍊", unit: "kg", inStock: true },
      { name: "Green Grapes", description: "Seedless green grapes", price: 7.99, image: "🍇", unit: "kg", inStock: true }
    ];

    // Add some cakes
    const cakesItems = [
      { name: "Chocolate Cake", description: "Rich chocolate layer cake", price: 24.99, image: "🍰", unit: "piece", inStock: true },
      { name: "Vanilla Birthday Cake", description: "Classic vanilla cake with frosting", price: 22.99, image: "🎂", unit: "piece", inStock: true },
      { name: "Red Velvet Cupcakes", description: "Set of 6 red velvet cupcakes", price: 12.99, image: "🧁", unit: "pack", inStock: true },
      { name: "Fresh Donuts", description: "Glazed donuts pack of 6", price: 8.99, image: "🍩", unit: "pack", inStock: true }
    ];

    // Add fruits products
    if (fruitsCategory) {
      for (const item of fruitsItems) {
        await ctx.db.insert("products", {
          ...item,
          categoryId: fruitsCategory._id,
        });
      }
    }

    // Add cakes products
    if (cakesCategory) {
      for (const item of cakesItems) {
        await ctx.db.insert("products", {
          ...item,
          categoryId: cakesCategory._id,
        });
      }
    }

    return "Fruits and cakes added successfully!";
  },
});
