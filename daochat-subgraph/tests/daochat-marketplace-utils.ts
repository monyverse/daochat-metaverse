import { newMockEvent } from "matchstick-as"
import { ethereum, BigInt, Address, Bytes } from "@graphprotocol/graph-ts"
import {
  OrderBid,
  OrderCancelled,
  OrderCreated,
  OrderFilled,
  RoleAdminChanged,
  RoleGranted,
  RoleRevoked
} from "../generated/DaochatMarketplace/DaochatMarketplace"

export function createOrderBidEvent(
  orderId: BigInt,
  bidder: Address,
  bidAmount: BigInt
): OrderBid {
  let orderBidEvent = changetype<OrderBid>(newMockEvent())

  orderBidEvent.parameters = new Array()

  orderBidEvent.parameters.push(
    new ethereum.EventParam(
      "orderId",
      ethereum.Value.fromUnsignedBigInt(orderId)
    )
  )
  orderBidEvent.parameters.push(
    new ethereum.EventParam("bidder", ethereum.Value.fromAddress(bidder))
  )
  orderBidEvent.parameters.push(
    new ethereum.EventParam(
      "bidAmount",
      ethereum.Value.fromUnsignedBigInt(bidAmount)
    )
  )

  return orderBidEvent
}

export function createOrderCancelledEvent(orderId: BigInt): OrderCancelled {
  let orderCancelledEvent = changetype<OrderCancelled>(newMockEvent())

  orderCancelledEvent.parameters = new Array()

  orderCancelledEvent.parameters.push(
    new ethereum.EventParam(
      "orderId",
      ethereum.Value.fromUnsignedBigInt(orderId)
    )
  )

  return orderCancelledEvent
}

export function createOrderCreatedEvent(
  orderId: BigInt,
  kind: i32,
  openFrom: BigInt,
  openTo: BigInt,
  maker: Address,
  currency: Address,
  price: BigInt,
  tokenContract: Address,
  tokenId: BigInt
): OrderCreated {
  let orderCreatedEvent = changetype<OrderCreated>(newMockEvent())

  orderCreatedEvent.parameters = new Array()

  orderCreatedEvent.parameters.push(
    new ethereum.EventParam(
      "orderId",
      ethereum.Value.fromUnsignedBigInt(orderId)
    )
  )
  orderCreatedEvent.parameters.push(
    new ethereum.EventParam(
      "kind",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(kind))
    )
  )
  orderCreatedEvent.parameters.push(
    new ethereum.EventParam(
      "openFrom",
      ethereum.Value.fromUnsignedBigInt(openFrom)
    )
  )
  orderCreatedEvent.parameters.push(
    new ethereum.EventParam("openTo", ethereum.Value.fromUnsignedBigInt(openTo))
  )
  orderCreatedEvent.parameters.push(
    new ethereum.EventParam("maker", ethereum.Value.fromAddress(maker))
  )
  orderCreatedEvent.parameters.push(
    new ethereum.EventParam("currency", ethereum.Value.fromAddress(currency))
  )
  orderCreatedEvent.parameters.push(
    new ethereum.EventParam("price", ethereum.Value.fromUnsignedBigInt(price))
  )
  orderCreatedEvent.parameters.push(
    new ethereum.EventParam(
      "tokenContract",
      ethereum.Value.fromAddress(tokenContract)
    )
  )
  orderCreatedEvent.parameters.push(
    new ethereum.EventParam(
      "tokenId",
      ethereum.Value.fromUnsignedBigInt(tokenId)
    )
  )

  return orderCreatedEvent
}

export function createOrderFilledEvent(
  orderId: BigInt,
  taker: Address,
  paidAmount: BigInt
): OrderFilled {
  let orderFilledEvent = changetype<OrderFilled>(newMockEvent())

  orderFilledEvent.parameters = new Array()

  orderFilledEvent.parameters.push(
    new ethereum.EventParam(
      "orderId",
      ethereum.Value.fromUnsignedBigInt(orderId)
    )
  )
  orderFilledEvent.parameters.push(
    new ethereum.EventParam("taker", ethereum.Value.fromAddress(taker))
  )
  orderFilledEvent.parameters.push(
    new ethereum.EventParam(
      "paidAmount",
      ethereum.Value.fromUnsignedBigInt(paidAmount)
    )
  )

  return orderFilledEvent
}

export function createRoleAdminChangedEvent(
  role: Bytes,
  previousAdminRole: Bytes,
  newAdminRole: Bytes
): RoleAdminChanged {
  let roleAdminChangedEvent = changetype<RoleAdminChanged>(newMockEvent())

  roleAdminChangedEvent.parameters = new Array()

  roleAdminChangedEvent.parameters.push(
    new ethereum.EventParam("role", ethereum.Value.fromFixedBytes(role))
  )
  roleAdminChangedEvent.parameters.push(
    new ethereum.EventParam(
      "previousAdminRole",
      ethereum.Value.fromFixedBytes(previousAdminRole)
    )
  )
  roleAdminChangedEvent.parameters.push(
    new ethereum.EventParam(
      "newAdminRole",
      ethereum.Value.fromFixedBytes(newAdminRole)
    )
  )

  return roleAdminChangedEvent
}

export function createRoleGrantedEvent(
  role: Bytes,
  account: Address,
  sender: Address
): RoleGranted {
  let roleGrantedEvent = changetype<RoleGranted>(newMockEvent())

  roleGrantedEvent.parameters = new Array()

  roleGrantedEvent.parameters.push(
    new ethereum.EventParam("role", ethereum.Value.fromFixedBytes(role))
  )
  roleGrantedEvent.parameters.push(
    new ethereum.EventParam("account", ethereum.Value.fromAddress(account))
  )
  roleGrantedEvent.parameters.push(
    new ethereum.EventParam("sender", ethereum.Value.fromAddress(sender))
  )

  return roleGrantedEvent
}

export function createRoleRevokedEvent(
  role: Bytes,
  account: Address,
  sender: Address
): RoleRevoked {
  let roleRevokedEvent = changetype<RoleRevoked>(newMockEvent())

  roleRevokedEvent.parameters = new Array()

  roleRevokedEvent.parameters.push(
    new ethereum.EventParam("role", ethereum.Value.fromFixedBytes(role))
  )
  roleRevokedEvent.parameters.push(
    new ethereum.EventParam("account", ethereum.Value.fromAddress(account))
  )
  roleRevokedEvent.parameters.push(
    new ethereum.EventParam("sender", ethereum.Value.fromAddress(sender))
  )

  return roleRevokedEvent
}
