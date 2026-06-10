export class MpesaCallbackDto {
  Body!: {
    stkCallback: {
      MerchantRequestID: string;
      CheckoutRequestID: string;
      ResultCode: number;
      ResultDesc: string;

      CallbackMetadata?: {
        Item: {
          Name: string;
          Value?: string | number;
        }[];
      };
    };
  };
}
