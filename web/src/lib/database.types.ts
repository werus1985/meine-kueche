
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "external_product_mappings": {
                  Row: {
                    "category_id": string | null,"household_id": string,"source": string,"tag": string,"unit_id": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "category_id"?: string | null,"household_id": string,"source"?: string,"tag": string,"unit_id"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "category_id"?: string | null,"household_id"?: string,"source"?: string,"tag"?: string,"unit_id"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "external_product_mappings_category_id_fkey"
      columns: ["category_id"]
isOneToOne: false
      referencedRelation: "kitchen_categories"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "external_product_mappings_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "external_product_mappings_unit_id_fkey"
      columns: ["unit_id"]
isOneToOne: false
      referencedRelation: "kitchen_units"
      referencedColumns: ["id"]
    }
                  ]
                },"household_invites": {
                  Row: {
                    "accepted_at": string | null,"created_at": string,"email": string,"expires_at": string,"household_id": string,"id": string,"invited_by": string,"role": string,"token_hash": string
                  }
                  ComputedFields: never
                  Insert: {
                    "accepted_at"?: string | null,"created_at"?: string,"email": string,"expires_at"?: string,"household_id": string,"id"?: string,"invited_by": string,"role"?: string,"token_hash": string
                  }
                  Update: {
                    "accepted_at"?: string | null,"created_at"?: string,"email"?: string,"expires_at"?: string,"household_id"?: string,"id"?: string,"invited_by"?: string,"role"?: string,"token_hash"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "household_invites_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "household_invites_role_fkey"
      columns: ["role"]
isOneToOne: false
      referencedRelation: "household_roles"
      referencedColumns: ["key"]
    }
                  ]
                },"household_members": {
                  Row: {
                    "household_id": string,"invited_by": string | null,"joined_at": string,"role": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "household_id": string,"invited_by"?: string | null,"joined_at"?: string,"role"?: string,"user_id": string
                  }
                  Update: {
                    "household_id"?: string,"invited_by"?: string | null,"joined_at"?: string,"role"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "household_members_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "household_members_role_fkey"
      columns: ["role"]
isOneToOne: false
      referencedRelation: "household_roles"
      referencedColumns: ["key"]
    }
                  ]
                },"household_roles": {
                  Row: {
                    "can_manage_household": boolean,"can_manage_members": boolean,"can_read": boolean,"can_write": boolean,"key": string,"name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "can_manage_household"?: boolean,"can_manage_members"?: boolean,"can_read"?: boolean,"can_write"?: boolean,"key": string,"name": string
                  }
                  Update: {
                    "can_manage_household"?: boolean,"can_manage_members"?: boolean,"can_read"?: boolean,"can_write"?: boolean,"key"?: string,"name"?: string
                  }
                  Relationships: [
                    
                  ]
                },"households": {
                  Row: {
                    "created_at": string,"created_by": string | null,"external_lookup_enabled": boolean,"id": string,"name": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"external_lookup_enabled"?: boolean,"id"?: string,"name": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"external_lookup_enabled"?: boolean,"id"?: string,"name"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"kitchen_categories": {
                  Row: {
                    "created_at": string,"created_by": string | null,"household_id": string,"id": string,"name": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"household_id": string,"id"?: string,"name": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"household_id"?: string,"id"?: string,"name"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "kitchen_categories_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    }
                  ]
                },"kitchen_category_settings": {
                  Row: {
                    "category_id": string,"default_sort": string,"household_id": string,"updated_at": string,"warning_basis": string,"warning_days": number
                  }
                  ComputedFields: never
                  Insert: {
                    "category_id": string,"default_sort"?: string,"household_id": string,"updated_at"?: string,"warning_basis"?: string,"warning_days"?: number
                  }
                  Update: {
                    "category_id"?: string,"default_sort"?: string,"household_id"?: string,"updated_at"?: string,"warning_basis"?: string,"warning_days"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "kitchen_category_settings_household_id_category_id_fkey"
      columns: ["household_id","category_id"]
isOneToOne: true
      referencedRelation: "kitchen_categories"
      referencedColumns: ["household_id","id"]
    }
                  ]
                },"kitchen_items": {
                  Row: {
                    "barcode": string | null,"category_id": string | null,"checked": boolean,"created_at": string,"created_by": string | null,"deleted_at": string | null,"expiry": string | null,"household_id": string,"id": string,"kind": string,"location_id": string | null,"name": string,"notes": string,"photo_path": string | null,"product_id": string | null,"purchased_at": string | null,"qty": number | null,"unit_id": string | null,"updated_at": string,"updated_by": string | null,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "barcode"?: string | null,"category_id"?: string | null,"checked"?: boolean,"created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"expiry"?: string | null,"household_id": string,"id"?: string,"kind": string,"location_id"?: string | null,"name": string,"notes"?: string,"photo_path"?: string | null,"product_id"?: string | null,"purchased_at"?: string | null,"qty"?: number | null,"unit_id"?: string | null,"updated_at"?: string,"updated_by"?: string | null,"version"?: number
                  }
                  Update: {
                    "barcode"?: string | null,"category_id"?: string | null,"checked"?: boolean,"created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"expiry"?: string | null,"household_id"?: string,"id"?: string,"kind"?: string,"location_id"?: string | null,"name"?: string,"notes"?: string,"photo_path"?: string | null,"product_id"?: string | null,"purchased_at"?: string | null,"qty"?: number | null,"unit_id"?: string | null,"updated_at"?: string,"updated_by"?: string | null,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "kitchen_items_category_id_fkey"
      columns: ["category_id"]
isOneToOne: false
      referencedRelation: "kitchen_categories"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "kitchen_items_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "kitchen_items_location_id_fkey"
      columns: ["location_id"]
isOneToOne: false
      referencedRelation: "kitchen_locations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "kitchen_items_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "kitchen_products"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "kitchen_items_unit_id_fkey"
      columns: ["unit_id"]
isOneToOne: false
      referencedRelation: "kitchen_units"
      referencedColumns: ["id"]
    }
                  ]
                },"kitchen_locations": {
                  Row: {
                    "created_at": string,"created_by": string | null,"household_id": string,"id": string,"name": string,"sort_order": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"household_id": string,"id"?: string,"name": string,"sort_order"?: number,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"household_id"?: string,"id"?: string,"name"?: string,"sort_order"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "kitchen_locations_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    }
                  ]
                },"kitchen_products": {
                  Row: {
                    "barcode": string | null,"category_id": string | null,"created_at": string,"created_by": string | null,"household_id": string,"id": string,"last_location_id": string | null,"name": string,"photo_path": string | null,"seasonal": boolean,"unit_id": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "barcode"?: string | null,"category_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"household_id": string,"id"?: string,"last_location_id"?: string | null,"name": string,"photo_path"?: string | null,"seasonal"?: boolean,"unit_id"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "barcode"?: string | null,"category_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"household_id"?: string,"id"?: string,"last_location_id"?: string | null,"name"?: string,"photo_path"?: string | null,"seasonal"?: boolean,"unit_id"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "kitchen_products_category_id_fkey"
      columns: ["category_id"]
isOneToOne: false
      referencedRelation: "kitchen_categories"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "kitchen_products_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "kitchen_products_last_location_id_fkey"
      columns: ["last_location_id"]
isOneToOne: false
      referencedRelation: "kitchen_locations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "kitchen_products_unit_id_fkey"
      columns: ["unit_id"]
isOneToOne: false
      referencedRelation: "kitchen_units"
      referencedColumns: ["id"]
    }
                  ]
                },"kitchen_quick_filter_categories": {
                  Row: {
                    "category_id": string,"filter_id": string,"household_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "category_id": string,"filter_id": string,"household_id": string
                  }
                  Update: {
                    "category_id"?: string,"filter_id"?: string,"household_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "kitchen_quick_filter_categories_household_id_category_id_fkey"
      columns: ["household_id","category_id"]
isOneToOne: false
      referencedRelation: "kitchen_categories"
      referencedColumns: ["household_id","id"]
    },{
      foreignKeyName: "kitchen_quick_filter_categories_household_id_filter_id_fkey"
      columns: ["household_id","filter_id"]
isOneToOne: false
      referencedRelation: "kitchen_quick_filters"
      referencedColumns: ["household_id","id"]
    }
                  ]
                },"kitchen_quick_filters": {
                  Row: {
                    "created_at": string,"created_by": string | null,"household_id": string,"id": string,"name": string,"sort_order": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"household_id": string,"id"?: string,"name": string,"sort_order"?: number,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"household_id"?: string,"id"?: string,"name"?: string,"sort_order"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "kitchen_quick_filters_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    }
                  ]
                },"kitchen_units": {
                  Row: {
                    "created_at": string,"created_by": string | null,"household_id": string,"id": string,"name": string,"sort_order": number,"step_size": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"household_id": string,"id"?: string,"name": string,"sort_order"?: number,"step_size"?: number,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"household_id"?: string,"id"?: string,"name"?: string,"sort_order"?: number,"step_size"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "kitchen_units_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "created_at": string,"display_name": string | null,"id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"display_name"?: string | null,"id": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"display_name"?: string | null,"id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "accept_household_invite":
{ Args: { "p_token": string }; Returns: string
                           },
"cleanup_unused_kitchen_products":
{ Args: { "p_household_id": string,"p_min_age_days"?: number }; Returns: {
              "photo_path": string,"product_id": string
            }[]
                           },
"create_household":
{ Args: { "p_name": string }; Returns: {
              "created_at": string,
"created_by": string | null,
"external_lookup_enabled": boolean,
"id": string,
"name": string,
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "households"
        isOneToOne: true
        isSetofReturn: false
      } },
"create_household_invite":
{ Args: { "p_email": string,"p_household_id": string,"p_role"?: string }; Returns: string
                           },
"delete_category":
{ Args: { "p_category_id": string,"p_household_id": string }; Returns: undefined
                           },
"delete_household":
{ Args: { "p_household_id": string }; Returns: undefined
                           },
"delete_location":
{ Args: { "p_household_id": string,"p_location_id": string }; Returns: undefined
                           },
"delete_unit":
{ Args: { "p_household_id": string,"p_unit_id": string }; Returns: undefined
                           },
"delete_unused_kitchen_product":
{ Args: { "p_household_id": string,"p_product_id": string }; Returns: string
                           },
"find_or_create_kitchen_product":
{ Args: { "p_barcode": string,"p_category_id": string,"p_household_id": string,"p_name": string,"p_unit_id": string }; Returns: {
              "created": boolean,"product_id": string
            }[]
                           },
"get_household_invite":
{ Args: { "p_token": string }; Returns: {
              "accepted_at": string,"email": string,"expires_at": string,"household_id": string,"household_name": string,"role": string
            }[]
                           },
"get_household_members":
{ Args: { "p_household_id": string }; Returns: {
              "display_name": string,"email": string,"joined_at": string,"role": string,"user_id": string
            }[]
                           },
"has_household_permission":
{ Args: { "p_household_id": string,"p_permission": string }; Returns: boolean
                           },
"is_household_member":
{ Args: { "p_household_id": string }; Returns: boolean
                           },
"remove_household_member":
{ Args: { "p_household_id": string,"p_user_id": string }; Returns: undefined
                           },
"revoke_household_invite":
{ Args: { "p_invite_id": string }; Returns: undefined
                           },
"set_member_role":
{ Args: { "p_household_id": string,"p_role": string,"p_user_id": string }; Returns: undefined
                           },
"shares_household_with":
{ Args: { "p_user_id": string }; Returns: boolean
                           },
"storage_household_id":
{ Args: { "p_name": string }; Returns: string
                           },
"update_kitchen_product_item":
{ Args: { "p_barcode": string,"p_category_id": string,"p_checked": boolean,"p_expected_version": number,"p_expiry": string,"p_household_id": string,"p_item_id": string,"p_location_id": string,"p_name": string,"p_notes": string,"p_photo_path": string,"p_purchased_at": string,"p_qty": number,"p_unit_id": string }; Returns: undefined
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            
          }
        }
} as const
