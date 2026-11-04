export class ClientWorkflowReservedError extends Error {
  constructor(message = "Client is reserved by an immutable workflow run") {
    super(message);
    this.name = "ClientWorkflowReservedError";
  }
}
