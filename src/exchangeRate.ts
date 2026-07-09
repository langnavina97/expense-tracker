export async function getExchangeRate(from: string, to: string, amount: number): Promise<number | null> {
    if(from === to) {
        return amount;
    }

  try {
    const response = await fetch(`https://api.frankfurter.dev/v1/latest?base=${from}&symbols=${to}`);
    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    const conversionRate = data.rates[to];

    const convertedAmount = Math.round(amount * conversionRate);

    
    return convertedAmount;

  } catch (error) {
    console.error("Error fetching exchange rate:", error);
    return null;
  }
}

