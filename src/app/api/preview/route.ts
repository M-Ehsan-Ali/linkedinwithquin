import { print } from "graphql/language/printer";

// import { ContentNode } from "@/gql/graphql";
import { fetchGraphQL } from "@/utils/fetchGraphQL";
import gql from "graphql-tag";
import { draftMode } from "next/headers";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get("secret");
  const id = searchParams.get("id");

  if (secret !== process.env.HEADLESS_SECRET || !id) {
    return new Response("Invalid token", { status: 401 });
  }

  const mutation = gql`
  mutation LoginUser {
    login( input: {
      clientMutationId: "uniqueId",
      username: "${process.env.WP_USER}",
      password: "${process.env.WP_APP_PASS}"
    } ) {
      authToken
      user {
        id
        name
      }
    }
  }
`;

  const { login } = await fetchGraphQL<{ login: any }>(print(mutation));

  const authToken = login.authToken;

  (await draftMode()).enable();

  const query = gql`
    query GetContentNode($id: ID!) {
      contentNode(id: $id, idType: DATABASE_ID) {
        uri
        status
        databaseId
      }
    }
  `;

  const { contentNode } = await fetchGraphQL<{ contentNode: any }>(
    print(query),
    {
      id,
    },
    { Authorization: `Bearer ${authToken}` }
  );

  if (!contentNode) {
    return new Response("Invalid id", { status: 401 });
  }

  const response = NextResponse.redirect(
    `${process.env.NEXT_PUBLIC_BASE_URL}${
      contentNode.status === "draft"
        ? `/preview/${contentNode.databaseId}`
        : contentNode.uri
    }`
  );

  response.headers.set("Set-Cookie", `wp_jwt=${authToken}; path=/;`);

  return response;
}