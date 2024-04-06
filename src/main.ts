import Fastify from "fastify";
import mercurius from "mercurius";
import { fetch } from "undici";
import { setTimeout } from "node:timers/promises";

const app = Fastify();

const schema = /* GraphQL */ `
  type Element {
    id: ID!
    name: String!
    child: Element!
  }

  type Query {
    elements: [Element!]!
  }
`;

const resolvers = {
  Element: {
    child: async function (element: TestElement) {
      // mock a delay in child resolver so that the delete happens before resolving this nested resolver
      await setTimeout(10);

      // at this moment the id does not exist anymore in the elementChilds object - the resolver fails
      return elementChilds[element.id];
    },
  },
  Query: {
    elements: () => elements,
  },
};

app.register(mercurius, {
  schema,
  resolvers,
});

type TestElement = {
  id: number;
  name: string;
};

const elements: TestElement[] = [];
const elementChilds: Record<number, TestElement> = {};

app.get("/elements", async function (req, reply) {
  // create an element with the id 1
  const id = elements.length + 1;
  elements.push({ id, name: "Parent" });
  elementChilds[id] = { id: 1, name: "Child" };

  // fetch all elements

  const query = "{ elements {id name child {id name}} }";
  return reply.graphql(query);
});

app.get("/delete", async function (req, reply) {
  // delete the first element and child association with the id 1
  const id = elements[0].id;
  delete elements[0];
  delete elementChilds[id];

  return reply.status(200).send();
});

app.listen({ port: 3000 }).then(() => {
  doRequests();
});

// mock requests
async function doRequests() {
  // create elements and fetch them
  const promiseCreate = fetch("http://localhost:3000/elements");

  // delete the element while fetching
  const resDelete = await fetch("http://localhost:3000/delete");

  const json = await (await promiseCreate).json();
  console.log(json, resDelete.status);
}
