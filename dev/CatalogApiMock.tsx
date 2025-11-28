import {
  AddLocationRequest,
  AddLocationResponse,
  CatalogApi,
  CatalogRequestOptions,
  GetEntitiesByRefsRequest,
  GetEntitiesByRefsResponse,
  GetEntitiesRequest,
  GetEntitiesResponse,
  GetEntityAncestorsRequest,
  GetEntityAncestorsResponse,
  GetEntityFacetsRequest,
  GetEntityFacetsResponse,
  GetLocationsResponse,
  Location,
  QueryEntitiesRequest,
  QueryEntitiesResponse,
  StreamEntitiesRequest,
  ValidateEntityResponse,
} from "@backstage/catalog-client";
import { CompoundEntityRef, Entity } from "@backstage/catalog-model";
import {
  AnalyzeLocationRequest,
  AnalyzeLocationResponse,
} from "@backstage/plugin-catalog-common";

export class CatalogApiMock implements CatalogApi {
  addLocation(
    _location: AddLocationRequest,
    _options?: CatalogRequestOptions
  ): Promise<AddLocationResponse> {
    return Promise.reject();
  }

  getEntities(
    _request?: GetEntitiesRequest,
    _options?: CatalogRequestOptions
  ): Promise<GetEntitiesResponse> {
    return Promise.resolve({
      items: [
        {
          apiVersion: "scaffolder.backstage.io/v1beta3",
          kind: "Template",
          metadata: {
            name: "v1beta3-demo",
            title: "Test Action template",
            description: "scaffolder v1beta3 template demo",
          },
          spec: {
            owner: "backstage/techdocs-core",
            type: "service",
            parameters: [
              {
                title: "Fill in some steps",
                required: ["name"],
                properties: {
                  name: {
                    title: "Name",
                    type: "string",
                    description: "Unique name of the component",
                    "ui:autofocus": true,
                    "ui:options": {
                      rows: 5,
                    },
                  },
                  owner: {
                    title: "Owner",
                    type: "string",
                    description: "Owner of the component",
                    "ui:field": "OwnerPicker",
                    "ui:options": {
                      catalogFilter: {
                        kind: "Group",
                      },
                    },
                  },
                },
              },
              {
                title: "Choose a location",
                required: ["repoUrl"],
                properties: {
                  repoUrl: {
                    title: "Repository Location",
                    type: "string",
                    "ui:field": "RepoUrlPicker",
                    "ui:options": {
                      allowedHosts: ["github.com"],
                    },
                  },
                },
              },
            ],
            steps: [
              {
                id: "fetchBase",
                name: "Fetch Base",
                action: "fetch:template",
                input: {
                  url: "./template",
                  values: {
                    name: "${{ parameters.name }}",
                    owner: "${{ parameters.owner }}",
                  },
                },
              },
              {
                id: "fetchDocs",
                name: "Fetch Docs",
                action: "fetch:plain",
                input: {
                  targetPath: "./community",
                  url: "https://github.com/backstage/community/tree/main/backstage-community-sessions",
                },
              },
              {
                id: "publish",
                name: "Publish",
                action: "publish:github",
                input: {
                  description: "This is ${{ parameters.name }}",
                  repoUrl: "${{ parameters.repoUrl }}",
                  defaultBranch: "main",
                },
              },
              {
                id: "register",
                name: "Register",
                action: "catalog:register",
                input: {
                  repoContentsUrl:
                    "${{ steps.publish.output.repoContentsUrl }}",
                  catalogInfoPath: "/catalog-info.yaml",
                },
              },
            ],
            output: {
              links: [
                {
                  title: "Repository",
                  url: "${{ steps['publish'].output.remoteUrl }}",
                },
                {
                  title: "Open in catalog",
                  icon: "catalog",
                  entityRef: "${{ steps['register'].output.entityRef }}",
                },
              ],
            },
          },
        },
      ],
    });
  }

  getEntitiesByRefs(
    _request: GetEntitiesByRefsRequest,
    _options?: CatalogRequestOptions
  ): Promise<GetEntitiesByRefsResponse> {
    return Promise.reject();
  }

  getEntityAncestors(
    _request: GetEntityAncestorsRequest,
    _options?: CatalogRequestOptions
  ): Promise<GetEntityAncestorsResponse> {
    return Promise.reject();
  }

  getEntityByRef(
    _entityRef: string | CompoundEntityRef,
    _options?: CatalogRequestOptions
  ): Promise<Entity | undefined> {
    return Promise.reject();
  }

  getEntityFacets(
    _request: GetEntityFacetsRequest,
    _options?: CatalogRequestOptions
  ): Promise<GetEntityFacetsResponse> {
    return Promise.reject();
  }

  getLocationById(
    _id: string,
    _options?: CatalogRequestOptions
  ): Promise<Location | undefined> {
    return Promise.reject();
  }

  getLocationByRef(
    _locationRef: string,
    _options?: CatalogRequestOptions
  ): Promise<Location | undefined> {
    return Promise.reject();
  }

  refreshEntity(
    _entityRef: string,
    _options?: CatalogRequestOptions
  ): Promise<void> {
    return Promise.reject();
  }

  removeEntityByUid(
    _uid: string,
    _options?: CatalogRequestOptions
  ): Promise<void> {
    return Promise.reject();
  }

  removeLocationById(
    _id: string,
    _options?: CatalogRequestOptions
  ): Promise<void> {
    return Promise.reject();
  }

  validateEntity(
    _entity: Entity,
    _locationRef: string,
    _options?: CatalogRequestOptions
  ): Promise<ValidateEntityResponse> {
    return Promise.resolve({ valid: true });
  }

  queryEntities(
    _request?: QueryEntitiesRequest,
    _options?: CatalogRequestOptions
  ): Promise<QueryEntitiesResponse> {
    return Promise.reject();
  }

  getLocationByEntity(
    _entity: string | CompoundEntityRef,
    _options?: CatalogRequestOptions
  ): Promise<Location | undefined> {
    return Promise.resolve(undefined);
  }

  getLocations(
    _request?: {} | undefined,
    _options?: CatalogRequestOptions | undefined
  ): Promise<GetLocationsResponse> {
    throw new Error("Method not implemented.");
  }

  analyzeLocation(
    _: AnalyzeLocationRequest,
    __?: CatalogRequestOptions
  ): Promise<AnalyzeLocationResponse> {
    throw new Error("Method not implemented.");
  }

  streamEntities(
    _?: StreamEntitiesRequest,
    __?: CatalogRequestOptions
  ): AsyncIterable<Entity[]> {
    throw new Error("Method not implemented.");
  }
}
